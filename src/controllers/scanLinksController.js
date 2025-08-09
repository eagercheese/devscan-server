const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');
const whitelistService = require('../services/whitelistService');
const ScanSession = require('../models/ScanSession');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

// ==============================
// CORE LINK PROCESSING FUNCTION
// ==============================
// Centralized logic for processing a single link through the security pipeline
async function processSingleLink(url, sessionId = null, shouldCache = true) {
  const scanResultsController = require('./scanResultsController');
  const scannedLinkController = require('./scannedLinkController');
  
  try {
    // Save link to database for tracking
    const link = await scannedLinkController.createScannedLink(sessionId, url);
    
    // ==============================
    // STEP 1: CACHE CHECK
    // ==============================
    const cached = await cacheService.getCachedResult(link.link_ID);
    if (cached) {
      console.log(`[Link Processor] Cache hit for URL: ${url}`);
      return { result: cached, fromCache: true };
    }
    
    // ==============================
    // STEP 2: WHITELIST CHECK (NOW INSTANT!)
    // ==============================
    const whitelistResult = whitelistService.checkWhitelist(url);
    
    if (whitelistResult.isWhitelisted) {
      console.log(`\n[Link Processor] ✅ Whitelisted: ${url} (${whitelistResult.reason})`);
      const result = await scanResultsController.createWhitelistResult(whitelistResult, link.link_ID, sessionId);
      return { result, fromCache: false, whitelisted: true };
    }
    
    // ==============================
    // STEP 3: MACHINE LEARNING ANALYSIS
    // ==============================
    let verdict = {
      isMalicious: false,
      anomalyScore: 0.1,
      classificationScore: 0.9,
      intelMatch: 'none'
    };

    try {
      const mlResponse = await mlService.analyzeLinks([url]);
      if (mlResponse && mlResponse.verdicts && mlResponse.verdicts[0]) {
        verdict = mlResponse.verdicts[0];
        console.log(`\n[Link Processor] 🤖 ML analysis: ${url} -> ${verdict.isMalicious ? 'MALICIOUS' : 'SAFE'} (score: ${verdict.anomalyScore.toFixed(3)})`);
      }
    } catch (mlError) {
      console.warn(`\n[Link Processor] ⚠️ ML service unavailable, using default verdict for ${url}`);
    }

    // Store result with caching if requested
    const result = shouldCache 
      ? await scanResultsController.createResultWithCache(verdict, link.link_ID, sessionId)
      : await ScanResults.create({
          isMalicious: verdict.isMalicious,
          anomalyScore: verdict.anomalyScore,
          classificationScore: verdict.classificationScore,
          intelMatch: verdict.intelMatch || 'none',
          link_ID: link.link_ID,
          session_ID: sessionId
        });

    return { result, fromCache: false, whitelisted: false };
    
  } catch (error) {
    console.error(`[Link Processor] Error processing link ${url}:`, error);
    throw error;
  }
}

// ==============================
// HTTP ENDPOINTS
// ==============================

// POST /api/scan-links - Bulk scanning endpoint
exports.scanLinks = async (req, res) => {
  try {
    const { session_ID, links } = req.body;
    if (!session_ID || !Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'session_ID and links array are required' });
    }
    
    // Check session exists
    const session = await ScanSession.findByPk(session_ID);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Process each link
    const results = [];
    for (const url of links) {
      try {
        const { result } = await processSingleLink(url, session_ID, true);
        results.push(result);
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        // Continue processing other links even if one fails
      }
    }
    
    // Include ScannedLink data in the response for client processing
    const enrichedResults = await Promise.all(results.map(async (result) => {
      const scannedLink = await ScannedLink.findByPk(result.link_ID);
      return {
        ...result.toJSON(),
        ScannedLink: scannedLink ? scannedLink.toJSON() : null
      };
    }));
    
    res.json({ results: enrichedResults });
  } catch (error) {
    console.error('Error scanning links:', error);
    res.status(500).json({ error: 'Failed to scan links' });
  }
};

// POST /api/scan-link - Single link scanning endpoint (for quick tests)
exports.scanLink = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    console.log('Scanning link:', url);
    
    // Check fast URL cache first (10 minute TTL)
    const cachedResult = cacheService.getCachedResultByUrlFast(url);
    if (cachedResult) {
      console.log('⚡ Fast cache hit for URL:', url);
      return res.json({
        isMalicious: cachedResult.isMalicious,
        anomalyScore: parseFloat(cachedResult.anomalyScore),
        classificationScore: parseFloat(cachedResult.classificationScore),
        intelMatch: cachedResult.intelMatch,
        cached: true,
        whitelisted: cachedResult.whitelisted || false
      });
    }
    
    const { result, fromCache, whitelisted } = await processSingleLink(url, null, false);
    
    const response = {
      isMalicious: result.isMalicious,
      anomalyScore: parseFloat(result.anomalyScore),
      classificationScore: parseFloat(result.classificationScore),
      intelMatch: result.intelMatch,
      cached: fromCache,
      whitelisted: whitelisted || false
    };
    
    // Store in fast URL cache for future requests
    cacheService.setCachedResultByUrlFast(url, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error in scanLink:', error);
    res.status(500).json({ error: 'Failed to scan link', details: error.message });
  }
};

// ==============================
// BULK LINK PROCESSING FOR EXTENSION (PAGE-AWARE)
// ==============================
// Process multiple links for extension with page-based deduplication and caching
exports.processBulkLinksForExtension = async (links, sessionId, alreadyProcessed, pageUrl = null) => {
  const scannedLinkController = require('./scannedLinkController');
  
  // Get cached verdicts for already processed links
  const verdicts = await scannedLinkController.getCachedVerdicts(links, sessionId, alreadyProcessed, convertToVerdict);
  
  // Filter out already processed links
  const newLinks = links.filter(url => !alreadyProcessed.has(url));
  
  // Process only new links through the centralized security pipeline
  for (const url of newLinks) {
    try {
      const { result } = await processSingleLink(url, sessionId, true);
      verdicts[url] = convertToVerdict(result);
    } catch (linkError) {
      console.error(`[Link Processor] Error processing link ${url}:`, linkError);
      verdicts[url] = 'failed';
    }
  }
  
  return {
    verdicts,
    newLinksProcessed: newLinks.length,
    cachedLinksReturned: links.length - newLinks.length
  };
};

// Helper function to convert scan results to extension-friendly verdict categories
function convertToVerdict(scanResult) {
  if (scanResult.isMalicious) {
    return 'malicious';
  }
  
  const anomalyScore = parseFloat(scanResult.anomalyScore);
  
  if (anomalyScore > 0.7) {
    return 'danger';
  } else if (anomalyScore > 0.5) {
    return 'warning';
  } else if (anomalyScore > 0.3) {
    return 'anomalous';
  } else {
    return 'safe';
  }
}

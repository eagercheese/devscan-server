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
    // ==============================
    // STEP 0: URL-BASED CACHE CHECK FIRST
    // ==============================
    const urlCached = await cacheService.getCachedResultByUrl(url);
    if (urlCached) {
      console.log(`[Link Processor] 💾 URL cache hit for: ${url}`);
      return { result: urlCached, fromCache: true };
    }
    
    // Save link to database for tracking
    const link = await scannedLinkController.createScannedLink(sessionId, url);
    
    // ==============================
    // STEP 1: LINK ID CACHE CHECK (FALLBACK)
    // ==============================
    const cached = await cacheService.getCachedResult(link.link_ID);
    if (cached) {
      console.log(`[Link Processor] 🗄️ Database cache hit for URL: ${url}`);
      return { result: cached, fromCache: true };
    }
    
    // ==============================
    // STEP 2: WHITELIST CHECK (NOW INSTANT!)
    // ==============================
    const whitelistResult = whitelistService.checkWhitelist(url);
    const suspiciousKeywords = [
    "redirect", "target", "dest", "goto",
    "login", "verify", "account", "secure", "update",
    ".exe", ".zip", ".scr", ".apk", ".php",
    "javascript:", "data:", "base64"
];

    function checkValue(label, decodedValue) {
        // Layer 1: Keyword Detection
        const hasKeyword = suspiciousKeywords.some(word =>
            decodedValue.toLowerCase().includes(word)
        );

        // Layer 2: Base64 Check
        let hasSuspiciousDecoded = false;
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (base64Regex.test(decodedValue)) {
            try {
                const base64Decoded = atob(decodedValue);
                const decodedHasKeyword = suspiciousKeywords.some(word =>
                    base64Decoded.toLowerCase().includes(word)
                );
                if (decodedHasKeyword) {
                    hasSuspiciousDecoded = true;
                }
            } catch {}
        }

        return hasKeyword || hasSuspiciousDecoded;
    }

    function isUrlMalicious(url) {
        try {
            const parsed = new URL(url);

            // 1️⃣ Check query parameters
            for (const [key, value] of parsed.searchParams.entries()) {
                const decodedValue = decodeURIComponent(value || "");
                if (checkValue(`Query Param "${key}"`, key + "=" + decodedValue)) {
                    return true;
                }
            }

            // 2️⃣ Check path segments
            const pathSegments = parsed.pathname.split("/").filter(Boolean);
            for (const segment of pathSegments) {
                const decodedSegment = decodeURIComponent(segment);
                if (checkValue(`Path Segment`, decodedSegment)) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }
    
    // Check whitelist and if found under go for further verification
    if (whitelistResult.isWhitelisted) {
      console.log(`\n[Link Processor] ✅ Whitelisted - Proceeding to further verification`);

      if (!isUrlMalicious(url)){
        console.log(`\n[Link Processor] ✅ Whitelisted and Verified: ${url} (${whitelistResult.reason})`);

        const result = await scanResultsController.createWhitelistResult(whitelistResult, link.link_ID, sessionId);
        return { result, fromCache: false, whitelisted: true };

      }
    }
    
    // ==============================
    // STEP 3: MACHINE LEARNING ANALYSIS
    // ==============================
    let verdict = {
  final_verdict: 'Unknown',
  confidence_score: '0%',
  anomaly_risk_level: 'Unknown',
  explanation: '',
  tip: '',
  cacheSource: '',
  lastScanned: null,
  expiresAt: null
    };
    // for trial
    // return { verdict, fromCache: false, whitelisted: false };

    try {
      const mlResponse = await mlService.analyzeLinks([url]);
      if (mlResponse && mlResponse.verdicts && Array.isArray(mlResponse.verdicts) && mlResponse.verdicts.length > 0) {
        verdict = mlResponse.verdicts[0];
        console.log(`\n[Link Processor] 🤖 ML analysis: ${url} -> ${verdict.final_verdict} (confidence: ${verdict.confidence_score}, risk: ${verdict.anomaly_risk_level})`);
      } else {
        console.warn(`\n[Link Processor] ⚠️ ML service returned unexpected format for ${url}, trying individual fallback...`);
        verdict = await mlService.analyzeLinkWithFallback(url);
      }
    } catch (mlError) {
      console.error(`\n[Link Processor] ⚠️ ML service error for ${url}, trying fallback:`, mlError.message);
      verdict = await mlService.analyzeLinkWithFallback(url);
    }

    // Store result with caching if requested
    const result = shouldCache 
      ? await scanResultsController.createResultWithCache(verdict, link.link_ID, sessionId)
      : await ScanResults.create({
          final_verdict: verdict.final_verdict,
          confidence_score: verdict.confidence_score,
          anomaly_risk_level: verdict.anomaly_risk_level,
          explanation: verdict.explanation,
          tip: verdict.tip,
          cacheSource: verdict.cacheSource,
          lastScanned: verdict.lastScanned,
          expiresAt: verdict.expiresAt,
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
    
    // Check cache first (both fast cache and database)
    const cachedResult = await cacheService.getCachedResultByUrl(url);
    if (cachedResult) {
      console.log('💾 Cache hit for URL:', url);
      return res.json({
        final_verdict: cachedResult.final_verdict,
        confidence_score: cachedResult.confidence_score,
        anomaly_risk_level: cachedResult.anomaly_risk_level,
        explanation: cachedResult.explanation,
        tip: cachedResult.tip,
        cacheSource: cachedResult.cacheSource,
        lastScanned: cachedResult.lastScanned,
        expiresAt: cachedResult.expiresAt,
        cached: true,
        whitelisted: cachedResult.whitelisted || false
      });
    }
    
    const { result, fromCache, whitelisted } = await processSingleLink(url, null, false);
    
    const response = {
      final_verdict: result.final_verdict,
      confidence_score: result.confidence_score,
      anomaly_risk_level: result.anomaly_risk_level,
      explanation: result.explanation,
      tip: result.tip,
      cacheSource: result.cacheSource,
      lastScanned: result.lastScanned,
      expiresAt: result.expiresAt,
      cached: fromCache,
      whitelisted: whitelisted || false
    };
    
    // Store in full cache system (both fast cache and database)
    await cacheService.setCachedResultByUrl(url, response);
    
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
        const verdict = convertToVerdict(result);
        console.log(`[Link Processor] 🎯 Converting result for ${url}:`, verdict);
        verdicts[url] = verdict;
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

// Helper function to convert scan results to extension-friendly verdict object
function convertToVerdict(scanResult) {
  // If scanResult is null or failed, return a default verdict
  if (!scanResult || typeof scanResult !== 'object') {
    return {
      final_verdict: 'Scan Failed',
      confidence_score: '0%',
      anomaly_risk_level: 'Unknown',
      explanation: 'Unable to scan this link at the moment.',
      tip: 'The scanning service is temporarily unavailable.'
    };
  }

  // Return the full ML verdict object if available
  return {
    final_verdict: scanResult.final_verdict || 'Unknown',
    confidence_score: scanResult.confidence_score || '0%',
    anomaly_risk_level: scanResult.anomaly_risk_level || 'Unknown',
    explanation: scanResult.explanation || '',
    tip: scanResult.tip || '',
    cacheSource: scanResult.cacheSource || '',
    lastScanned: scanResult.lastScanned || null,
    expiresAt: scanResult.expiresAt || null
  };
}

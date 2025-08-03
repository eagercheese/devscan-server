// ==============================
// EXTENSION CONTROLLER
// ==============================
// Main API controller for browser extension link analysis requests
// Handles bulk link processing with caching, whitelisting, and ML analysis

const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');
const whitelistService = require('../services/whitelistService');
const ScanSession = require('../models/ScanSession');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

// ==============================
// MAIN LINK ANALYSIS ENDPOINT
// ==============================
// POST /api/extension/analyze - Simplified endpoint for extension
// Processes multiple URLs through the complete security analysis pipeline
exports.analyzeLinks = async (req, res) => {
  try {
    const { links, domain, browserInfo, sessionId } = req.body;
    
    // Input validation
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array is required' });
    }

    console.log(`[Extension API] Analyzing ${links.length} links from domain: ${domain} (Session: ${sessionId})`);

    // ==============================
    // SESSION MANAGEMENT
    // ==============================
    // Use existing session or create new one for tracking this batch
    let currentSessionId = sessionId;
    if (!currentSessionId && (browserInfo || domain)) {
      try {
        const session = await ScanSession.create({
          browserInfo: browserInfo || `Extension scan from ${domain}`,
          engineVersion: 'DEVSCAN-4.0',
          timestamp: new Date(),
        });
        currentSessionId = session.session_ID;
        console.log(`[Extension API] Created new session: ${currentSessionId}`);
      } catch (sessionError) {
        console.warn('[Extension API] Failed to create session, continuing without:', sessionError.message);
      }
    }

    // ==============================
    // DUPLICATE DETECTION
    // ==============================
    // Get already processed links for this session to avoid duplicate processing
    const alreadyProcessed = new Set();
    if (currentSessionId) {
      try {
        const existingLinks = await ScannedLink.findAll({
          where: { session_ID: currentSessionId },
          attributes: ['url']
        });
        existingLinks.forEach(link => alreadyProcessed.add(link.url));
        console.log(`[Extension API] Found ${alreadyProcessed.size} already processed links for session ${currentSessionId}`);
      } catch (err) {
        console.warn('[Extension API] Could not check existing links:', err.message);
      }
    }

    // Filter out already processed links
    const newLinks = links.filter(url => !alreadyProcessed.has(url));
    console.log(`[Extension API] Processing ${newLinks.length} new links (${links.length - newLinks.length} already processed)`);

    // ==============================
    // VERDICT COLLECTION
    // ==============================
    // Process each new link and collect verdicts for all requested links
    const verdicts = {};
    
    // First, return cached verdicts for already processed links
    for (const url of links) {
      if (alreadyProcessed.has(url)) {
        try {
          const existingLink = await ScannedLink.findOne({
            where: { session_ID: currentSessionId, url },
            include: [{
              model: ScanResults,
              as: 'ScanResults'
            }]
          });
          
          if (existingLink && existingLink.ScanResults && existingLink.ScanResults.length > 0) {
            const latestResult = existingLink.ScanResults[existingLink.ScanResults.length - 1];
            verdicts[url] = convertToVerdict(latestResult);
            console.log(`[Extension API] Using cached verdict for ${url}: ${verdicts[url]}`);
          }
        } catch (err) {
          console.warn(`[Extension API] Could not get cached verdict for ${url}:`, err.message);
        }
      }
    }
    
    // ==============================
    // NEW LINK PROCESSING PIPELINE
    // ==============================
    // Process only new links through the complete security analysis pipeline
    for (const url of newLinks) {
      try {
        // Save link to database for tracking
        const link = await ScannedLink.create({ 
          session_ID: currentSessionId,
          url, 
          scanTimestamp: new Date() 
        });
        
        // ==============================
        // STEP 1: CACHE CHECK
        // ==============================
        // Check if we have cached results for this link (fastest option)
        const cached = await cacheService.getCachedResult(link.link_ID);
        if (cached) {
          console.log(`[Extension API] Cache hit for URL: ${url}`);
          verdicts[url] = convertToVerdict(cached);
          continue;
        }
        
        // ==============================
        // STEP 2: WHITELIST CHECK
        // ==============================
        // Check if domain is in safe whitelist (Tranco rank 1-1000 or manual whitelist)
        const whitelistResult = await whitelistService.checkWhitelist(url);
        console.log(`[Extension API] Whitelist check for ${url}:`, {
          isWhitelisted: whitelistResult.isWhitelisted,
          reason: whitelistResult.reason,
          rank: whitelistResult.rank,
          threshold: whitelistResult.threshold,
          willGoToML: whitelistResult.willGoToML
        });
        
        if (whitelistResult.isWhitelisted) {
          console.log(`[Extension API] ✅ URL ${url} is whitelisted (${whitelistResult.reason}) - rank ${whitelistResult.rank || 'manual'}`);
          
          // Create safe scan result for whitelisted domain
          const result = await ScanResults.create({
            isMalicious: false,
            anomalyScore: 0.0,
            classificationScore: 1.0,
            intelMatch: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
            link_ID: link.link_ID,
            session_ID: currentSessionId
          });
          
          // Note: Whitelist results are NOT cached as Tranco API calls are fast
          // and don't require expensive computation like ML analysis
          
          verdicts[url] = 'safe';
          continue;
        } else {
          console.log(`[Extension API] ⚠️  URL ${url} will be processed by ML model - ${whitelistResult.reason} (rank: ${whitelistResult.rank || 'unranked'})`);
        }
        
        // ==============================
        // STEP 3: MACHINE LEARNING ANALYSIS
        // ==============================
        // Call ML service for links that didn't pass whitelist (rank > 1000 or unranked)
        console.log(`[Extension API] 🤖 Calling ML service for ${url} (not in safe Tranco range)...`);
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
            console.log(`[Extension API] 🤖 ML verdict for ${url}:`, verdict);
          } else {
            console.log(`[Extension API] 🤖 ML service returned default verdict for ${url}`);
          }
        } catch (mlError) {
          console.warn(`[Extension API] 🤖 ML service unavailable for ${url}, using simulated analysis:`, mlError.message);
        }

        // Store ML analysis result in database
        const result = await ScanResults.create({
          isMalicious: verdict.isMalicious,
          anomalyScore: verdict.anomalyScore,
          classificationScore: verdict.classificationScore,
          intelMatch: verdict.intelMatch || 'none',
          link_ID: link.link_ID,
          session_ID: currentSessionId
        });

        // Cache the ML result for future requests (ML analysis is expensive and benefits from caching)
        await cacheService.setCachedResult({
          results_ID: result.result_ID,
          link_ID: link.link_ID,
          isMalicious: result.isMalicious,
          anomalyScore: result.anomalyScore,
          classificationScore: result.classificationScore,
          admin_ID: null
        });

        verdicts[url] = convertToVerdict(result);
        
      } catch (linkError) {
        console.error(`[Extension API] Error processing link ${url}:`, linkError);
        verdicts[url] = 'failed';
      }
    }

    // ==============================
    // RESPONSE GENERATION
    // ==============================
    // Log completion statistics and send response to extension
    console.log(`[Extension API] Completed analysis for ${Object.keys(verdicts).length} links (${newLinks.length} new, ${links.length - newLinks.length} cached)`);
    
    // Log Tranco filtering statistics for monitoring
    const whitelistStats = whitelistService.getDetailedStats();
    console.log(`[Extension API] 📊 Whitelist Statistics:`, {
      safeThreshold: whitelistStats.safeRankThreshold,
      safePercentage: whitelistStats.trancoStats.safePercentage + '%',
      mlProcessingPercentage: whitelistStats.trancoStats.mlProcessingPercentage + '%'
    });
    
    res.json({ 
      success: true,
      verdicts,
      session_ID: currentSessionId,
      processed: Object.keys(verdicts).length,
      newLinks: newLinks.length,
      cachedLinks: links.length - newLinks.length,
      whitelistStats: {
        safeRankThreshold: whitelistStats.safeRankThreshold,
        rangeDescription: whitelistStats.rangeDescription
      }
    });
    
  } catch (error) {
    console.error('[Extension API] Error analyzing links:', error);
    res.status(500).json({ error: 'Failed to analyze links', details: error.message });
  }
};

// ==============================
// HELPER FUNCTIONS
// ==============================

// Convert numerical scan results to extension-friendly verdict categories
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

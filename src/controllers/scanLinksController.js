const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');
const whitelistService = require('../services/whitelistService');
const ScanSession = require('../models/ScanSession');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

// ==============================
// HELPER FUNCTIONS FOR MALICIOUS URL DETECTION
// ==============================
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

// ==============================
// CORE LINK PROCESSING FUNCTION
// ==============================
// Optimized sequence: WHITELIST → CACHE → ML ANALYSIS
async function processSingleLink(url, sessionId = null, shouldCache = true) {
  const scanResultsController = require('./scanResultsController');
  const scannedLinkController = require('./scannedLinkController');
  
  try {
    console.log(`\n[Link Processor] 🔍 Processing: ${url}`);
    
    // Save link to database for tracking (needed for all subsequent steps)
    const link = await scannedLinkController.createScannedLink(sessionId, url);
    
    // ==============================
    // STEP 1: WHITELIST CHECK (FASTEST - CHECK FIRST!)
    // ==============================
    console.log(`[Link Processor] 📋 Checking whitelist for: ${url}`);
    const whitelistResult = whitelistService.checkWhitelist(url);
    
    if (whitelistResult.isWhitelisted) {
      console.log(`[Link Processor] ✅ Whitelisted: ${url} (${whitelistResult.reason})`);
      
      // Additional malicious pattern check for whitelisted URLs
      if (!isUrlMalicious(url)) {
        console.log(`[Link Processor] ✅ Whitelisted and Verified: ${url}`);
        const result = await scanResultsController.createWhitelistResult(whitelistResult, link.link_ID, sessionId);
        return { result, fromCache: false, whitelisted: true };
      } else {
        console.log(`[Link Processor] ⚠️ Whitelisted but contains suspicious patterns: ${url}`);
        // Continue to ML analysis despite whitelist
      }
    }
    
    // ==============================
    // STEP 2: CACHE CHECK (ONLY FOR ML RESULTS)
    // ==============================
    console.log(`[Link Processor] 💾 Checking cache for: ${url}`);
    const urlCached = await cacheService.getCachedResultByUrl(url);
    if (urlCached) {
      console.log(`[Link Processor] 🎯 Cache hit for: ${url}`);
      return { result: urlCached, fromCache: true };
    }
    
    // Fallback: check cache by link ID
    const cached = await cacheService.getCachedResult(link.link_ID);
    if (cached) {
      console.log(`[Link Processor] 🗄️ Database cache hit for: ${url}`);
      return { result: cached, fromCache: true };
    }

    
    // ==============================
    // STEP 3: MACHINE LEARNING ANALYSIS (ONLY ML RESULTS GET CACHED)
    // ==============================
    console.log(`[Link Processor] 🤖 Sending to ML analysis: ${url}`);
    
    let verdict = {
      final_verdict: 'Unknown',
      confidence_score: '0%',
      anomaly_risk_level: 'Unknown',
      explanation: 'Unable to analyze this URL',
      tip: 'Please try again later',
      cacheSource: '',
      lastScanned: null,
      expiresAt: null
    };

    try {
      const mlResponse = await mlService.analyzeLinks([url]);
      if (mlResponse && mlResponse.verdicts && Array.isArray(mlResponse.verdicts) && mlResponse.verdicts.length > 0) {
        verdict = mlResponse.verdicts[0];
        console.log(`[Link Processor] ✅ ML analysis complete: ${url} -> ${verdict.final_verdict} (${verdict.confidence_score})`);
      } else {
        console.warn(`[Link Processor] ⚠️ ML service returned unexpected format for ${url}, trying fallback...`);
        verdict = await mlService.analyzeLinkWithFallback(url);
      }
    } catch (mlError) {
      console.error(`[Link Processor] ⚠️ ML service error for ${url}:`, mlError.message);
      verdict = await mlService.analyzeLinkWithFallback(url);
    }

    // ==============================
    // STEP 4: CACHE ML RESULTS ONLY (NOT WHITELIST RESULTS)
    // ==============================
    console.log(`[Link Processor] 💾 Caching ML result for: ${url}`);
    const result = shouldCache 
      ? await scanResultsController.createResultWithCache(verdict, link.link_ID, sessionId)
      : await ScanResults.create({
          final_verdict: verdict.final_verdict,
          confidence_score: verdict.confidence_score,
          anomaly_risk_level: verdict.anomaly_risk_level,
          explanation: verdict.explanation,
          tip: verdict.tip,
          link_ID: link.link_ID,
          session_ID: sessionId
        });

    return { result, fromCache: false, whitelisted: false };
    
  } catch (error) {
    console.error(`[Link Processor] ❌ Error processing ${url}:`, error);
    throw error;
  }
}

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
        console.log(`[Link Processor] Processing new link: ${url}`);
        const { result } = await processSingleLink(url, sessionId, true);
        const verdict = convertToVerdict(result);
        console.log(`[Link Processor] ✅ Result: ${verdict} for ${url}`);
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

// ==============================
// LEGACY HTTP ENDPOINTS (STUBS)
// ==============================
// These are kept for backward compatibility but not actively used by the extension

// Bulk scanning endpoint (legacy)
exports.scanLinks = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use /api/extension/analyze instead',
    message: 'This endpoint has been deprecated in favor of the optimized extension API'
  });
};

// Single link scanning endpoint (legacy)
exports.scanLink = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use /api/extension/analyze instead',
    message: 'This endpoint has been deprecated in favor of the optimized extension API'
  });
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

  // Handle Sequelize model instances
  const data = scanResult.dataValues || scanResult;
  // Return the full ML verdict object if available
  const verdict = {
    final_verdict: data.final_verdict || 'Unknown',
    confidence_score: data.confidence_score || '0%',
    anomaly_risk_level: data.anomaly_risk_level || 'Unknown',
    explanation: data.explanation || '',
    tip: data.tip || '',
    cacheSource: data.cacheSource || '',
    lastScanned: data.lastScanned || null,
    expiresAt: data.expiresAt || null
  };
  
  return verdict;
}

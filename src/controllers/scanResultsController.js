const ScanResults = require('../models/ScanResults');
const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');
const cacheService = require('../services/cacheService');

// ==============================
// INTERNAL HELPER FUNCTIONS
// ==============================

// Internal helper function to create scan results (ML verdict format)
async function createScanResultRecord(resultData) {
  try {
    const result = await ScanResults.create(resultData);
    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating scan result:`, error);
    throw error;
  }
}

// ==============================
// CORE FUNCTIONS FOR EXTENSION
// ==============================

// Create scan result with caching for ML analysis
exports.createResultWithCache = async (verdict, linkId, sessionId) => {
  try {
    // Store ML analysis result in database
    const result = await createScanResultRecord({
      final_verdict: verdict.final_verdict,
      confidence_score: verdict.confidence_score,
      anomaly_risk_level: verdict.anomaly_risk_level,
      explanation: verdict.explanation,
      tip: verdict.tip,
      link_ID: linkId,
      session_ID: sessionId
    });

    // Cache the ML result with ALL features for retraining
    const cacheData = {
      results_ID: result.result_ID,
      link_ID: linkId,
      final_verdict: result.final_verdict,
      confidence_score: result.confidence_score,
      anomaly_risk_level: result.anomaly_risk_level,
      explanation: result.explanation,
      tip: result.tip,
      // Include ML features for retraining
      anomaly_score: verdict.anomaly_score !== undefined ? verdict.anomaly_score : null
    };

    // Add all ML features if they exist in the verdict
    if (verdict.features) {
      const features = verdict.features;
      cacheData.who_is = features.who_is !== undefined ? features.who_is : null;
      cacheData.https = features.https !== undefined ? features.https : null;
      cacheData.js_len = features.js_len !== undefined ? features.js_len : null;
      cacheData.js_obf_len = features.js_obf_len !== undefined ? features.js_obf_len : null;
      cacheData.contains_suspicious_tld = features.contains_suspicious_tld !== undefined ? features.contains_suspicious_tld : null;
      cacheData.char_continuity_rate = features.char_continuity_rate !== undefined ? features.char_continuity_rate : null;
      cacheData.num_dots_url = features.num_dots_url !== undefined ? features.num_dots_url : null;
      cacheData.domain_url_ratio = features.domain_url_ratio !== undefined ? features.domain_url_ratio : null;
      cacheData.tld_length = features.tld_length !== undefined ? features.tld_length : null;
      cacheData.path_url_ratio = features.path_url_ratio !== undefined ? features.path_url_ratio : null;
      cacheData.path_domain_ratio = features.path_domain_ratio !== undefined ? features.path_domain_ratio : null;
      cacheData.entropy_extension = features.entropy_extension !== undefined ? features.entropy_extension : null;
      cacheData.path_token_count = features.path_token_count !== undefined ? features.path_token_count : null;
      cacheData.iso_score = features.iso_score !== undefined ? features.iso_score : null;
    }

    await cacheService.setCachedResult(cacheData);
    console.log(`[Results Manager] ✅ Cached ML result with features for retraining`);

    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating cached result for link ${linkId}:`, error);
    throw error;
  }
};

// Create scan result for whitelisted domains (not cached)
exports.createWhitelistResult = async (whitelistResult, linkId, sessionId) => {
  try {
    const result = await createScanResultRecord({
      final_verdict: 'Whitelisted',
      confidence_score: '100%',
      anomaly_risk_level: 'Low',
      explanation: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
      tip: 'This domain is whitelisted and considered safe.',
      link_ID: linkId,
      session_ID: sessionId
    });
    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating whitelist result for link ${linkId}:`, error);
    throw error;
  }
};

// ==============================
// LEGACY HTTP ENDPOINTS (STUBS)
// ==============================
// These are kept for backward compatibility but not actively used by the extension

// Submit scan results (legacy)
exports.submitScanResult = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - results are managed automatically',
    message: 'Scan results are now automatically managed by the extension API'
  });
};

// Get scan results by link (legacy)
exports.getResultsByLink = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use extension API instead',
    message: 'Result retrieval is handled by the optimized extension API'
  });
};

// Get scan results by session (legacy)
exports.getResultsBySession = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use extension API instead',
    message: 'Result retrieval is handled by the optimized extension API'
  });
};

// ==============================
// LEGACY HTTP ENDPOINTS (MINIMAL STUBS)
// ==============================

// Submit scan results for a scanned link (HTTP endpoint - legacy)
exports.submitScanResult = async (req, res) => {
  try {
    const { final_verdict, confidence_score, anomaly_risk_level, explanation, tip, link_ID, session_ID } = req.body;
    if (!final_verdict || !confidence_score || !anomaly_risk_level || !link_ID || !session_ID) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if link and session exist
    const link = await ScannedLink.findByPk(link_ID);
    const session = await ScanSession.findByPk(session_ID);
    if (!link || !session) {
      return res.status(404).json({ error: 'Scanned link or session not found' });
    }
    
    const result = await createScanResultRecord({
      final_verdict,
      confidence_score,
      anomaly_risk_level,
      explanation,
      tip,
      link_ID,
      session_ID,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Error submitting scan result:', error);
    res.status(500).json({ error: 'Failed to submit scan result' });
  }
};

// Get scan results by link_ID (HTTP endpoint - legacy)
exports.getResultsByLink = async (req, res) => {
  try {
    const { link_ID } = req.params;
    const results = await ScanResults.findAll({ where: { link_ID } });
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No scan results found for this link' });
    }
    res.json(results);
  } catch (error) {
    console.error('Error fetching scan results:', error);
    res.status(500).json({ error: 'Failed to fetch scan results' });
  }
};

// Get scan results by session_ID (HTTP endpoint - legacy)
exports.getResultsBySession = async (req, res) => {
  try {
    const { session_ID } = req.params;
    const results = await ScanResults.findAll({ where: { session_ID } });
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No scan results found for this session' });
    }
    res.json(results);
  } catch (error) {
    console.error('Error fetching scan results:', error);
    res.status(500).json({ error: 'Failed to fetch scan results' });
  }
};

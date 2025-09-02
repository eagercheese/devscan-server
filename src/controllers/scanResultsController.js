const ScanResults = require('../models/ScanResults');
const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');
const cacheService = require('../services/cacheService');

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

// Submit scan results for a scanned link (HTTP endpoint)
exports.submitScanResult = async (req, res) => {
  try {
    const { final_verdict, confidence_score, anomaly_risk_level, explanation, tip, link_ID, session_ID } = req.body;
    if (
      !final_verdict ||
      !confidence_score ||
      !anomaly_risk_level ||
      !link_ID ||
      !session_ID
    ) {
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

// Get scan results by link_ID
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

// Get scan results by session_ID
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

    // Cache the ML result for future requests
    await cacheService.setCachedResult({
      results_ID: result.result_ID,
      link_ID: linkId,
      final_verdict: result.final_verdict,
      confidence_score: result.confidence_score,
      anomaly_risk_level: result.anomaly_risk_level,
      explanation: result.explanation,
      tip: result.tip
    });

    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating result with cache for link ${linkId}:`, error);
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

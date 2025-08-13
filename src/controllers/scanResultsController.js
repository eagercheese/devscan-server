const ScanResults = require('../models/ScanResults');
const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');
const cacheService = require('../services/cacheService');

// Internal helper function to create scan results
async function createScanResultRecord(resultData) {
  try {
    const result = await ScanResults.create(resultData);
    // Silent creation - only log errors
    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating scan result:`, error);
    throw error;
  }
}

// Submit scan results for a scanned link (HTTP endpoint)
exports.submitScanResult = async (req, res) => {
  try {
    const { isMalicious, anomalyScore, classificationScore, intelMatch, link_ID, session_ID } = req.body;
    if (
      typeof isMalicious === 'undefined' ||
      anomalyScore === undefined ||
      classificationScore === undefined ||
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
      isMalicious,
      anomalyScore,
      classificationScore,
      intelMatch,
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
      isMalicious: verdict.isMalicious,
      anomalyScore: verdict.anomalyScore,
      classificationScore: verdict.classificationScore,
      intelMatch: verdict.intelMatch || 'none',
      link_ID: linkId,
      session_ID: sessionId
    });

    // Cache the ML result for future requests (ML analysis is expensive and benefits from caching)
    await cacheService.setCachedResult({
      results_ID: result.result_ID,
      link_ID: linkId,
      isMalicious: result.isMalicious,
      anomalyScore: result.anomalyScore,
      classificationScore: result.classificationScore,
      admin_ID: null
    });

    // Silent storage - only log errors
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
      isMalicious: false,
      anomalyScore: 0.0,
      classificationScore: 1.0,
      intelMatch: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
      link_ID: linkId,
      session_ID: sessionId
    });

    // Silent whitelist storage - only log errors
    return result;
  } catch (error) {
    console.error(`[Results Manager] Error creating whitelist result for link ${linkId}:`, error);
    throw error;
  }
};

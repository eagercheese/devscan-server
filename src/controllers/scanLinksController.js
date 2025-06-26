const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');
const ScanSession = require('../models/ScanSession');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

// POST /api/scan-links
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
    // For each link, check cache first
    const results = [];
    for (const url of links) {
      // Save link to ScannedLink
      const link = await ScannedLink.create({ session_ID, url, scanTimestamp: new Date() });
      // Check cache
      const cached = await cacheService.getCachedResult(link.link_ID);
      if (cached) {
        results.push(cached);
        continue;
      }
      // Call ML service if not cached
      const [verdict] = await mlService.analyzeLinks([url]);
      const result = await ScanResults.create({
        isMalicious: verdict.isMalicious,
        anomalyScore: verdict.anomalyScore,
        classificationScore: verdict.classificationScore,
        intelMatch: verdict.intelMatch,
        link_ID: link.link_ID,
        session_ID
      });
      // Cache the result
      await cacheService.setCachedResult({
        results_ID: result.result_ID,
        link_ID: link.link_ID,
        isMalicious: result.isMalicious,
        anomalyScore: result.anomalyScore,
        classificationScore: result.classificationScore,
        admin_ID: null // or set if available
      });
      results.push(result);
    }
    res.json({ results });
  } catch (error) {
    console.error('Error scanning links:', error);
    res.status(500).json({ error: 'Failed to scan links' });
  }
};

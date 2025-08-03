const ScanResults = require('../models/ScanResults');
const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');

// Submit scan results for a scanned link
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
    const result = await ScanResults.create({
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

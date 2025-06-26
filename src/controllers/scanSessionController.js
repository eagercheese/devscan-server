const ScanSession = require('../models/ScanSession');

// Create a new scan session
exports.createScanSession = async (req, res) => {
  try {
    const { browserInfo, engineVersion } = req.body;
    if (!browserInfo || !engineVersion) {
      return res.status(400).json({ error: 'browserInfo and engineVersion are required' });
    }
    const session = await ScanSession.create({
      browserInfo,
      engineVersion,
      timestamp: new Date(),
    });
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating scan session:', error);
    res.status(500).json({ error: 'Failed to create scan session' });
  }
};

// Get all scan sessions
exports.getAllScanSessions = async (req, res) => {
  try {
    const sessions = await ScanSession.findAll();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching scan sessions:', error);
    res.status(500).json({ error: 'Failed to fetch scan sessions' });
  }
};

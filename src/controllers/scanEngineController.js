const ScanEngine = require('../models/ScanEngine');

// Get all ScanEngine records (HTTP endpoint)
exports.getAllScanEngines = async (req, res) => {
  try {
    const engines = await ScanEngine.findAll();
    res.json(engines);
  } catch (error) {
    console.error('Error fetching ScanEngine records:', error);
    res.status(500).json({ error: 'Failed to fetch ScanEngine records' });
  }
};

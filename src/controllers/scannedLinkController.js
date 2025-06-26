const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');

// Submit a link for scanning (create a ScannedLink record)
exports.submitLink = async (req, res) => {
  try {
    const { session_ID, url } = req.body;
    if (!session_ID || !url) {
      return res.status(400).json({ error: 'session_ID and url are required' });
    }
    // Check if session exists
    const session = await ScanSession.findByPk(session_ID);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }
    const scannedLink = await ScannedLink.create({
      session_ID,
      url,
      scanTimestamp: new Date(),
    });
    res.status(201).json(scannedLink);
  } catch (error) {
    console.error('Error submitting link:', error);
    res.status(500).json({ error: 'Failed to submit link' });
  }
};

// Get all scanned links
exports.getAllScannedLinks = async (req, res) => {
  try {
    const links = await ScannedLink.findAll();
    res.json(links);
  } catch (error) {
    console.error('Error fetching scanned links:', error);
    res.status(500).json({ error: 'Failed to fetch scanned links' });
  }
};

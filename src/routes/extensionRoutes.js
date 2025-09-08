const express = require('express');
const router = express.Router();
const extensionController = require('../controllers/extensionController');
const whitelistService = require('../services/whitelistService');
const { validateSession, rateLimitBySession } = require('../middleware/sessionValidation');

// Apply session validation and enhanced rate limiting to all extension routes
router.use(validateSession);
router.use(rateLimitBySession(1000, 60 * 60 * 1000, { 
  burst: 100, // Allow 100 requests per minute for normal browsing
  burstWindow: 60 * 1000 // 1 minute burst window
})); // 1000 requests per hour with burst support

// POST /api/extension/analyze - Main endpoint for extension link analysis
router.post('/analyze', extensionController.analyzeLinks);

// GET /api/extension/test-whitelist?url=... - Test whitelist for a specific URL
router.get('/test-whitelist', (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }
    
    const result = whitelistService.checkWhitelist(url);
    res.json({
      success: true,
      url,
      whitelistResult: result
    });
  } catch (error) {
    console.error('[Extension API] Error testing whitelist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test whitelist' 
    });
  }
});

// GET /api/extension/whitelist-stats - Get whitelist statistics
router.get('/whitelist-stats', (req, res) => {
  try {
    const stats = whitelistService.getDetailedStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Extension API] Error getting whitelist stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get whitelist statistics' 
    });
  }
});

module.exports = router;

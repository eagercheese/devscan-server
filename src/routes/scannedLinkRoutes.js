const express = require('express');
const router = express.Router();
const scannedLinkController = require('../controllers/scannedLinkController');

// POST /api/scanned-links
router.post('/', scannedLinkController.submitLink);

// GET /api/scanned-links
router.get('/', scannedLinkController.getAllScannedLinks);

module.exports = router;

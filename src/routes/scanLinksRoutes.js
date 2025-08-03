const express = require('express');
const router = express.Router();
const scanLinksController = require('../controllers/scanLinksController');

// POST /api/scan-links
router.post('/', scanLinksController.scanLinks);

// POST /api/scan-link (for extension quick test)
router.post('/scan-link', scanLinksController.scanLink);

module.exports = router;

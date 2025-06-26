const express = require('express');
const router = express.Router();
const scanLinksController = require('../controllers/scanLinksController');

// POST /api/scan-links
router.post('/', scanLinksController.scanLinks);

module.exports = router;

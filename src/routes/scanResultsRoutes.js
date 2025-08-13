const express = require('express');
const router = express.Router();
const scanResultsController = require('../controllers/scanResultsController');

// POST /api/scan-results
router.post('/', scanResultsController.submitScanResult);

// GET /api/scan-results/link/:link_ID
router.get('/link/:link_ID', scanResultsController.getResultsByLink);

// GET /api/scan-results/session/:session_ID
router.get('/session/:session_ID', scanResultsController.getResultsBySession);

module.exports = router;

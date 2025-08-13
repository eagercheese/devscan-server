const express = require('express');
const router = express.Router();
const scanSessionController = require('../controllers/scanSessionController');

// POST /api/scan-sessions
router.post('/', scanSessionController.createScanSession);

// GET /api/scan-sessions
router.get('/', scanSessionController.getAllScanSessions);

module.exports = router;

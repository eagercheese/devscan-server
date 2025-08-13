const express = require('express');
const router = express.Router();
const scanEngineController = require('../controllers/scanEngineController');

// GET /api/scan-engines
router.get('/', scanEngineController.getAllScanEngines);

module.exports = router;

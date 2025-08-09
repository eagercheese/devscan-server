const express = require('express');
const { scanAndExtractLinks } = require('../controllers/extractlinksController.js');

const router = express.Router();

router.post('/', scanAndExtractLinks);

module.exports = router;
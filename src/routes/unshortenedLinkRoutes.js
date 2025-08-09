// src/routes/unshortenedlinkRoutes.js
const express = require('express');
const { unshortenedLink } = require('../controllers/unshortenedLinkController.js');

const router = express.Router();

router.post('/', unshortenedLink);

module.exports = router;
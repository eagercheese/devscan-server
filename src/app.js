require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running.' });
});

// Import and use routes here
const scanEngineRoutes = require('./routes/scanEngineRoutes');
app.use('/api/scan-engines', scanEngineRoutes);

const scanSessionRoutes = require('./routes/scanSessionRoutes');
app.use('/api/scan-sessions', scanSessionRoutes);

const scannedLinkRoutes = require('./routes/scannedLinkRoutes');
app.use('/api/scanned-links', scannedLinkRoutes);

const scanResultsRoutes = require('./routes/scanResultsRoutes');
app.use('/api/scan-results', scanResultsRoutes);

const scanLinksRoutes = require('./routes/scanLinksRoutes');
app.use('/api/scan-links', scanLinksRoutes);

module.exports = app;
// ==============================
// DEVSCAN MAIN APPLICATION SETUP
// ==============================
// Express.js application configuration with middleware, routes, and debug endpoints
// This file defines the API structure and request handling pipeline

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// MIDDLEWARE CONFIGURATION
// ==============================
// Enable CORS for browser extension requests
app.use(cors());
// Parse JSON request bodies
app.use(express.json());

// ==============================
// UTILITY ENDPOINTS
// ==============================

// Health check endpoint for monitoring server status
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running.' });
});

// API health check endpoint specifically for extension
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is ready for extension requests.' });
});

// ML service health check endpoint
app.get('/health/ml', async (req, res) => {
  try {
    const mlService = require('./services/mlService');
    const healthCheck = await mlService.checkHealth();
    
    res.status(healthCheck.status === 'healthy' ? 200 : 503).json({
      ml_service: healthCheck,
      server_status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ml_service: { status: 'error', error: error.message },
      server_status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to inspect database content (development use)
app.get('/debug/database', async (req, res) => {
  try {
    const ScanSession = require('./models/ScanSession');
    const ScannedLink = require('./models/ScannedLink');
    
    // Get recent database entries for debugging
    const sessions = await ScanSession.findAll({
      order: [['session_ID', 'DESC']],
      limit: 10
    });
    
    const links = await ScannedLink.findAll({
      order: [['link_ID', 'DESC']],
      limit: 20
    });
    
    res.json({
      totalSessions: await ScanSession.count(),
      totalLinks: await ScannedLink.count(),
      recentSessions: sessions,
      recentLinks: links
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// API ROUTE REGISTRATION
// ==============================
// Register all API route handlers with their respective URL prefixes

// Scan engine management routes
const scanEngineRoutes = require('./routes/scanEngineRoutes');
app.use('/api/scan-engines', scanEngineRoutes);

// Scan session management routes
const scanSessionRoutes = require('./routes/scanSessionRoutes');
app.use('/api/scan-sessions', scanSessionRoutes);

// Scanned link tracking routes  
const scannedLinkRoutes = require('./routes/scannedLinkRoutes');
app.use('/api/scanned-links', scannedLinkRoutes);

// Scan results storage and retrieval routes
const scanResultsRoutes = require('./routes/scanResultsRoutes');
app.use('/api/scan-results', scanResultsRoutes);

// Legacy scan links routes (may be redundant with extension routes)
const scanLinksRoutes = require('./routes/scanLinksRoutes');
app.use('/api/scan-links', scanLinksRoutes);

// Main extension API routes (primary endpoint for browser extension)
const extensionRoutes = require('./routes/extensionRoutes');
app.use('/api/extension', extensionRoutes);

// Link extraction service routes
// This service extracts links from a malicious URL
const extractlinkRoutes = require('./routes/extractlinksRoutes');
app.use('/api/extract-links', extractlinkRoutes);

// Unshortened link service routes
const unshortenedLink = require('./routes/unshortenedLinkRoutes');
app.use('/api/unshortened-links', unshortenedLink);
module.exports = app;
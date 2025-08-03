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

module.exports = app;
// ==============================
// DEVSCAN MAIN APPLICATION SETUP
// ==============================
// Express.js application configuration with middleware, routes, and debug endpoints
// This file defines the API structure and request handling pipeline

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001; // Fixed: Changed from 3000 to 3001 to match start-server.js

// ==============================
// MIDDLEWARE CONFIGURATION
// ==============================

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  res.set('X-Request-ID', req.requestId);
  next();
});

// Enable CORS for browser extension requests
app.use(cors());
// Parse JSON request bodies with increased payload limits
app.use(express.json({ limit: '10mb' }));
// Set server timeout to 3 minutes to handle long ML processing
app.timeout = 180000; // 3 minutes

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
      error: 'ML service health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache cleanup endpoint for maintenance
app.post('/admin/cleanup-cache', async (req, res) => {
  try {
    const cacheService = require('./services/cacheService');
    await cacheService.cleanupFailedScans();
    
    res.status(200).json({
      success: true,
      message: 'Failed scan cache entries cleaned up successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cache cleanup failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==============================
// DATABASE DEBUG ENDPOINTS (DEBUG ONLY)
// ==============================

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

// ==============================
// ENHANCED ERROR HANDLING SYSTEM
// ==============================

// Custom API Error class for structured error responses
class APIError extends Error {
  constructor(message, code, details = null, statusCode = 500) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// Global error handler middleware
app.use((error, req, res, next) => {
  // Generate request ID for tracking
  const requestId = req.requestId || Date.now().toString();
  
  // Determine error details
  const isAPIError = error instanceof APIError;
  const statusCode = isAPIError ? error.statusCode : 500;
  
  const errorResponse = {
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'SERVER_ERROR',
    details: error.details,
    timestamp: new Date().toISOString(),
    requestId: requestId
  };

  // Add specific guidance based on error type
  switch (error.code) {
    case 'ML_SERVICE_DOWN':
      errorResponse.suggestion = 'ML service temporarily unavailable. Using fallback analysis.';
      errorResponse.fallback = true;
      break;
    case 'RATE_LIMIT_EXCEEDED':
    case 'BURST_LIMIT_EXCEEDED':
    case 'HOURLY_LIMIT_EXCEEDED':
      errorResponse.suggestion = 'Rate limit exceeded. Please wait before making more requests.';
      errorResponse.retryAfter = error.retryAfter;
      break;
    case 'INVALID_SESSION':
    case 'SESSION_EXPIRED':
      errorResponse.suggestion = 'Session invalid or expired. Extension will create a new session.';
      errorResponse.createNewSession = true;
      break;
    case 'DATABASE_ERROR':
      errorResponse.suggestion = 'Database temporarily unavailable. Please try again.';
      break;
    case 'INVALID_REQUEST':
      errorResponse.suggestion = 'Please check your request format and try again.';
      break;
    default:
      errorResponse.suggestion = 'An unexpected error occurred. Please try again or contact support.';
  }

  // Log error for debugging (but don't expose sensitive details to client)
  const logDetails = {
    error: error.message,
    code: error.code,
    statusCode,
    stack: error.stack,
    requestId,
    url: req.url,
    method: req.method,
    body: req.body ? JSON.stringify(req.body).slice(0, 500) : 'none',
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };
  
  if (statusCode >= 500) {
    console.error(`[API Error] ${error.code || 'UNKNOWN'}:`, logDetails);
  } else {
    console.warn(`[API Warning] ${error.code || 'UNKNOWN'}:`, logDetails);
  }

  res.status(statusCode).json(errorResponse);
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: {
      extension: '/api/extension/analyze',
      health: '/api/health',
      debug: '/debug/database'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
// ==============================
// EXTENSION CONTROLLER
// ==============================
// HTTP interface controller for browser extension requests
// Handles request/response formatting and delegates processing to other controllers

const scanSessionController = require('./scanSessionController');
const scannedLinkController = require('./scannedLinkController');
const scanLinksController = require('./scanLinksController');
const whitelistService = require('../services/whitelistService');

// Custom error class for API errors
class APIError extends Error {
  constructor(message, code, details = null, statusCode = 500) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// ==============================
// MAIN LINK ANALYSIS ENDPOINT
// ==============================
// POST /api/extension/analyze - Simplified endpoint for extension
// Processes multiple URLs through the complete security analysis pipeline
exports.analyzeLinks = async (req, res, next) => {
  try {
    const { links, domain, browserInfo, sessionId, pageUrl, pageRefreshed } = req.body;
    
    // Input validation with detailed error messages
    if (!Array.isArray(links) || links.length === 0) {
      throw new APIError(
        'Invalid request: links array is required and must not be empty',
        'INVALID_REQUEST',
        {
          received: typeof links,
          expected: 'array with at least one URL',
          example: { links: ['https://example.com'], domain: 'example.com' }
        },
        400
      );
    }

    // Validate URLs
    const validLinks = [];
    const invalidLinks = [];
    
    for (const link of links) {
      if (typeof link !== 'string' || link.trim().length === 0) {
        invalidLinks.push({ url: link, reason: 'Empty or non-string URL' });
        continue;
      }
      
      try {
        new URL(link); // Validate URL format
        validLinks.push(link);
      } catch (e) {
        invalidLinks.push({ url: link, reason: 'Invalid URL format' });
      }
    }

    if (validLinks.length === 0) {
      throw new APIError(
        'No valid URLs provided',
        'INVALID_REQUEST',
        {
          invalidLinks,
          message: 'All provided URLs were invalid or malformed'
        },
        400
      );
    }

    console.log(`[Extension API] 📥 Processing ${validLinks.length} valid links for domain: ${domain}`);
    if (invalidLinks.length > 0) {
      console.warn(`[Extension API] ⚠️ Skipped ${invalidLinks.length} invalid links:`, invalidLinks);
    }

    // ==============================
    // SESSION MANAGEMENT (ENHANCED)
    // ==============================
    let currentSessionId;
    
    if (req.createNewSession) {
      console.log(`[Extension API] Creating new session (reason: ${req.invalidSessionReason || 'no session provided'})`);
      currentSessionId = await scanSessionController.getOrCreateSession(null, browserInfo, domain);
      console.log(`[Extension API] ✅ Created new session: ${currentSessionId}`);
    } else {
      currentSessionId = sessionId || await scanSessionController.getOrCreateSession(sessionId, browserInfo, domain);
      console.log(`[Extension API] ✅ Using existing session: ${currentSessionId}`);
    }

    // ==============================
    // PAGE-BASED DUPLICATE DETECTION  
    // ==============================
    // Get already processed links for this PAGE (not entire session)
    const alreadyProcessed = await scannedLinkController.getProcessedLinksForPage(
      currentSessionId, 
      pageUrl, 
      pageRefreshed  // If page refreshed, ignore previous scans
    );

    // ==============================
    // BULK LINK PROCESSING (PAGE-AWARE)
    // ==============================
    // Delegate the actual processing to scanLinksController with page context
    const processingResult = await scanLinksController.processBulkLinksForExtension(
      validLinks, // Use validLinks instead of links
      currentSessionId, 
      alreadyProcessed,
      pageUrl  // Pass page context for better caching
    );

    // ==============================
    // RESPONSE GENERATION (ENHANCED)
    // ==============================
    const response = {
      success: true,
      verdicts: processingResult.verdicts,
      session_ID: currentSessionId,
      processed: Object.keys(processingResult.verdicts).length,
      newLinks: processingResult.newLinksProcessed,
      cachedLinks: processingResult.cachedLinksReturned,
      sessionStatus: req.createNewSession ? 'new_session_created' : 'existing_session_used'
    };

    // Add warning about invalid links if any
    if (invalidLinks.length > 0) {
      response.warnings = [{
        type: 'invalid_links',
        count: invalidLinks.length,
        message: `${invalidLinks.length} invalid URLs were skipped`,
        details: invalidLinks.slice(0, 5) // Only show first 5 invalid links
      }];
    }

    console.log(`[Extension API] 📤 Sending verdicts to extension:`, {
      verdictCount: Object.keys(processingResult.verdicts).length,
      sessionId: currentSessionId,
      sessionStatus: response.sessionStatus,
      warnings: response.warnings ? response.warnings.length : 0
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('[Extension API] Error analyzing links:', error);
    
    // Use next() to pass error to global error handler
    if (error instanceof APIError) {
      return next(error);
    }
    
    // Convert unknown errors to APIError
    next(new APIError(
      'Failed to analyze links',
      'ANALYSIS_ERROR',
      {
        originalError: error.message,
        stack: error.stack
      },
      500
    ));
  }
};

// ==============================
// EXTENSION CONTROLLER
// ==============================
// HTTP interface controller for browser extension requests
// Handles request/response formatting and delegates processing to other controllers

const scanSessionController = require('./scanSessionController');
const scannedLinkController = require('./scannedLinkController');
const scanLinksController = require('./scanLinksController');
const whitelistService = require('../services/whitelistService');

// ==============================
// MAIN LINK ANALYSIS ENDPOINT
// ==============================
// POST /api/extension/analyze - Simplified endpoint for extension
// Processes multiple URLs through the complete security analysis pipeline
exports.analyzeLinks = async (req, res) => {
  try {
    const { links, domain, browserInfo, sessionId, pageUrl, pageRefreshed } = req.body;
    
    // Input validation
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array is required' });
    }

    // ==============================
    // SESSION MANAGEMENT (PAGE-AWARE)
    // ==============================
    // Use existing session or create new one for tracking this batch
    const currentSessionId = await scanSessionController.getOrCreateSession(sessionId, browserInfo, domain);

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
      links, 
      currentSessionId, 
      alreadyProcessed,
      pageUrl  // NEW: Pass page context for better caching
    );

    // ==============================
    // RESPONSE GENERATION
    // ==============================
    // Send response to extension with processing results
    console.log(`[Extension API] 📤 Sending verdicts to extension:`, {
      verdictCount: Object.keys(processingResult.verdicts).length,
      verdicts: processingResult.verdicts,
      session_ID: currentSessionId
    });
    
    res.json({ 
      success: true,
      verdicts: processingResult.verdicts,
      session_ID: currentSessionId,
      processed: Object.keys(processingResult.verdicts).length,
      newLinks: processingResult.newLinksProcessed,
      cachedLinks: processingResult.cachedLinksReturned
    });
    
  } catch (error) {
    console.error('[Extension API] Error analyzing links:', error);
    res.status(500).json({ error: 'Failed to analyze links', details: error.message });
  }
};

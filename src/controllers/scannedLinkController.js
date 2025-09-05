const ScannedLink = require('../models/ScannedLink');
const ScanSession = require('../models/ScanSession');
const ScanResults = require('../models/ScanResults');

// ==============================
// INTERNAL HELPER FUNCTIONS
// ==============================

// Internal helper function to create a scanned link
async function createScannedLinkRecord(sessionId, url) {
  try {
    const link = await ScannedLink.create({ 
      session_ID: sessionId,
      url, 
      scanTimestamp: new Date() 
    });
    return link;
  } catch (error) {
    console.error(`[Link Manager] Error creating scanned link for ${url}:`, error);
    throw error;
  }
}

// ==============================
// CORE FUNCTIONS FOR EXTENSION
// ==============================

// Get already processed links for a specific PAGE (better than session-based)
exports.getProcessedLinksForPage = async (sessionId, pageUrl, pageRefreshed = false) => {
  try {
    const alreadyProcessed = new Set();
    
    // If page was refreshed, don't use any previous results
    if (pageRefreshed) {
      console.log(`[Link Manager] Page refreshed (${pageUrl}) - will rescan all links`);
      return alreadyProcessed;
    }
    
    if (sessionId && pageUrl) {
      // Only look for links scanned in the last 60 minutes for this specific page
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const existingLinks = await ScannedLink.findAll({
        where: { 
          session_ID: sessionId,
          scanTimestamp: {
            [require('sequelize').Op.gte]: sixtyMinutesAgo
          }
          // Note: We're not filtering by pageUrl yet since the model doesn't have it
          // This is a transitional approach - you may want to add pageUrl to ScannedLink model
        },
        attributes: ['url', 'scanTimestamp']
      });
      
      existingLinks.forEach(link => alreadyProcessed.add(link.url));
      console.log(`[Link Manager] Found ${alreadyProcessed.size} recently processed links for session ${sessionId} (last 10 minutes)`);
    }
    return alreadyProcessed;
  } catch (err) {
    console.warn('[Link Manager] Could not check existing page links:', err.message);
    return new Set();
  }
};

// Get cached verdicts for already processed links
exports.getCachedVerdicts = async (links, sessionId, alreadyProcessed, convertToVerdictFn) => {
  const verdicts = {};
  
  for (const url of links) {
    if (alreadyProcessed.has(url)) {
      try {
        const existingLink = await ScannedLink.findOne({
          where: { session_ID: sessionId, url },
          include: [{
            model: ScanResults,
            as: 'ScanResults'
          }]
        });
        
        if (existingLink && existingLink.ScanResults && existingLink.ScanResults.length > 0) {
          const latestResult = existingLink.ScanResults[existingLink.ScanResults.length - 1];
          verdicts[url] = convertToVerdictFn(latestResult);
          console.log(`[Link Manager] Using cached verdict for ${url}: ${verdicts[url]}`);
        }
      } catch (err) {
        console.warn(`[Link Manager] Could not get cached verdict for ${url}:`, err.message);
      }
    }
  }
  
  return verdicts;
};

// Create a new scanned link record (used by other controllers)
exports.createScannedLink = async (sessionId, url) => {
  return await createScannedLinkRecord(sessionId, url);
};

// ==============================
// LEGACY HTTP ENDPOINTS (STUBS)
// ==============================
// These are kept for backward compatibility but not actively used by the extension

// Submit a link for scanning (legacy)
exports.submitLink = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use /api/extension/analyze instead',
    message: 'Link submission is handled automatically by the extension API'
  });
};

// Get all scanned links (legacy)
exports.getAllScannedLinks = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use extension API instead',
    message: 'Link retrieval is handled by the optimized extension API'
  });
};

// ==============================
// LEGACY HTTP ENDPOINTS (MINIMAL STUBS)  
// ==============================

// Submit a link for scanning (HTTP endpoint - legacy)
exports.submitLink = async (req, res) => {
  try {
    const { session_ID, url } = req.body;
    if (!session_ID || !url) {
      return res.status(400).json({ error: 'session_ID and url are required' });
    }
    
    // Check if session exists
    const session = await ScanSession.findByPk(session_ID);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }
    
    const scannedLink = await createScannedLinkRecord(session_ID, url);
    res.status(201).json(scannedLink);
  } catch (error) {
    console.error('Error submitting link:', error);
    res.status(500).json({ error: 'Failed to submit link' });
  }
};

// Get all scanned links (HTTP endpoint - legacy)
exports.getAllScannedLinks = async (req, res) => {
  try {
    const links = await ScannedLink.findAll();
    res.json(links);
  } catch (error) {
    console.error('Error fetching scanned links:', error);
    res.status(500).json({ error: 'Failed to fetch scanned links' });
  }
};

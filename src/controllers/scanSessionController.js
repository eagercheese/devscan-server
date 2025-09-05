const ScanSession = require('../models/ScanSession');

// ==============================
// INTERNAL HELPER FUNCTIONS
// ==============================

// Internal helper function to create a session (used by other controllers)
async function createSession(browserInfo, engineVersion) {
  try {
    const session = await ScanSession.create({
      browserInfo,
      engineVersion,
      timestamp: new Date(),
    });
    console.log(`[Session Manager] Created new session: ${session.session_ID}`);
    return session.session_ID;
  } catch (error) {
    console.error('[Session Manager] Failed to create session:', error.message);
    throw error;
  }
}

// ==============================
// CORE FUNCTIONS FOR EXTENSION
// ==============================

// Get existing session or create new one for extension requests
exports.getOrCreateSession = async (sessionId, browserInfo, domain) => {
  try {
    // If sessionId is provided and valid, use it
    if (sessionId) {
      const existingSession = await ScanSession.findByPk(sessionId);
      if (existingSession) {
        console.log(`[Session Manager] Using existing session: ${sessionId}`);
        return sessionId;
      }
    }

    // Create new session if none provided or existing one not found
    if (browserInfo || domain) {
      const newSessionId = await createSession(
        browserInfo || `Extension scan from ${domain}`,
        'DEVSCAN-4.0'  // Use the engineVersion that exists in ScanEngine table
      );
      return newSessionId;
    }

    console.warn('[Session Manager] No session info provided, continuing without session');
    return null;
  } catch (sessionError) {
    console.warn('[Session Manager] Failed to get or create session:', sessionError.message);
    return null;
  }
};

// ==============================
// LEGACY HTTP ENDPOINTS (STUBS)
// ==============================
// These are kept for backward compatibility but not actively used by the extension

// Create a new scan session (legacy)
exports.createScanSession = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - sessions are managed automatically',
    message: 'Session creation is handled automatically by the extension API'
  });
};

// Get all scan sessions (legacy)
exports.getAllScanSessions = async (req, res) => {
  res.status(501).json({ 
    error: 'Legacy endpoint - use extension API instead',
    message: 'Session retrieval is handled by the optimized extension API'
  });
};

// ==============================
// LEGACY HTTP ENDPOINTS (MINIMAL STUBS)
// ==============================

// Create scan session (HTTP endpoint - legacy)
exports.createScanSession = async (req, res) => {
  try {
    const { browserInfo, engineVersion } = req.body;
    const sessionId = await createSession(browserInfo, engineVersion);
    res.status(201).json({ session_ID: sessionId });
  } catch (error) {
    console.error('Error creating scan session:', error);
    res.status(500).json({ error: 'Failed to create scan session' });
  }
};

// Get all scan sessions (HTTP endpoint - legacy)
exports.getAllScanSessions = async (req, res) => {
  try {
    const sessions = await ScanSession.findAll();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching scan sessions:', error);
    res.status(500).json({ error: 'Failed to fetch scan sessions' });
  }
};

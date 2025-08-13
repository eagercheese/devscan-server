const ScanSession = require('../models/ScanSession');

// Create a new scan session (HTTP endpoint)
exports.createScanSession = async (req, res) => {
  try {
    const { browserInfo, engineVersion } = req.body;
    if (!browserInfo || !engineVersion) {
      return res.status(400).json({ error: 'browserInfo and engineVersion are required' });
    }
    const session = await ScanSession.create({
      browserInfo,
      engineVersion,
      timestamp: new Date(),
    });
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating scan session:', error);
    res.status(500).json({ error: 'Failed to create scan session' });
  }
};

// Get all scan sessions (HTTP endpoint)
exports.getAllScanSessions = async (req, res) => {
  try {
    const sessions = await ScanSession.findAll();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching scan sessions:', error);
    res.status(500).json({ error: 'Failed to fetch scan sessions' });
  }
};

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
        'v2.1.0'  // Use the engineVersion that exists in ScanEngine table
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

// ==============================
// SESSION VALIDATION MIDDLEWARE
// ==============================
// Middleware to validate session IDs and prevent session hijacking

const ScanSession = require('../models/ScanSession');

// Validate session ID and ensure it exists and is active
exports.validateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      // Allow requests without session ID (will create new session)
      return next();
    }
    
    // Check if session exists and is recent (within last 24 hours)
    const session = await ScanSession.findByPk(sessionId);
    if (!session) {
      console.warn(`[Session Validation] Invalid session ID: ${sessionId}`);
      return res.status(401).json({ 
        error: 'Invalid session', 
        message: 'Session not found or expired' 
      });
    }
    
    // Check if session is too old (older than 24 hours)
    const sessionAge = Date.now() - new Date(session.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      console.warn(`[Session Validation] Expired session: ${sessionId}, age: ${sessionAge / 1000 / 60} minutes`);
      return res.status(401).json({ 
        error: 'Session expired', 
        message: 'Please refresh the extension to create a new session' 
      });
    }
    
    // Attach session info to request for use by controllers
    req.validatedSession = session;
    next();
    
  } catch (error) {
    console.error('[Session Validation] Error validating session:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
};

// Rate limiting per session to prevent abuse
exports.rateLimitBySession = (maxRequests = 1000, windowMs = 60 * 60 * 1000) => {
  const sessionRequestCounts = new Map();
  
  return (req, res, next) => {
    const sessionId = req.body.sessionId;
    if (!sessionId) return next();
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [sid, data] of sessionRequestCounts.entries()) {
      if (data.firstRequest < windowStart) {
        sessionRequestCounts.delete(sid);
      }
    }
    
    // Check current session
    const sessionData = sessionRequestCounts.get(sessionId);
    if (!sessionData) {
      sessionRequestCounts.set(sessionId, { 
        count: 1, 
        firstRequest: now 
      });
      return next();
    }
    
    if (sessionData.firstRequest < windowStart) {
      // Reset window
      sessionRequestCounts.set(sessionId, { 
        count: 1, 
        firstRequest: now 
      });
      return next();
    }
    
    if (sessionData.count >= maxRequests) {
      console.warn(`[Rate Limit] Session ${sessionId} exceeded rate limit: ${sessionData.count}/${maxRequests}`);
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'Too many requests from this session' 
      });
    }
    
    sessionData.count++;
    next();
  };
};

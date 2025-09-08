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
      req.createNewSession = true;
      console.log('[Session Validation] No session ID provided, will create new session');
      return next();
    }
    
    // Check if session exists and is recent (within last 24 hours)
    const session = await ScanSession.findByPk(sessionId);
    if (!session) {
      console.warn(`[Session Validation] Session not found: ${sessionId}, will create new session`);
      req.createNewSession = true;
      req.invalidSessionReason = 'Session not found';
      return next(); // Continue instead of rejecting
    }
    
    // Check if session is too old (older than 24 hours)
    const sessionAge = Date.now() - new Date(session.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      console.warn(`[Session Validation] Session expired: ${sessionId}, age: ${Math.round(sessionAge / 1000 / 60)} minutes, will create new session`);
      req.createNewSession = true;
      req.invalidSessionReason = 'Session expired';
      return next(); // Continue instead of rejecting
    }
    
    // Session is valid - attach session info to request
    req.validatedSession = session;
    console.log(`[Session Validation] ✅ Valid session: ${sessionId}`);
    next();
    
  } catch (error) {
    console.error('[Session Validation] Error validating session:', error);
    // On error, allow request to continue with new session creation
    req.createNewSession = true;
    req.invalidSessionReason = `Validation error: ${error.message}`;
    next();
  }
};

// Enhanced rate limiting per session with burst support and better error messages
exports.rateLimitBySession = (maxRequests = 1000, windowMs = 60 * 60 * 1000, options = {}) => {
  const sessionRequestCounts = new Map();
  const burstLimit = options.burst || 100; // Allow burst requests
  const burstWindowMs = options.burstWindow || 60 * 1000; // 1 minute burst window
  
  return (req, res, next) => {
    const sessionId = req.body.sessionId || `anonymous_${req.ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const burstWindowStart = now - burstWindowMs;
    
    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      for (const [sid, data] of sessionRequestCounts.entries()) {
        if (data.firstRequest < windowStart) {
          sessionRequestCounts.delete(sid);
        }
      }
    }
    
    // Get or create session data
    let sessionData = sessionRequestCounts.get(sessionId);
    if (!sessionData) {
      sessionData = { 
        count: 0, 
        firstRequest: now,
        burstCount: 0,
        lastBurstReset: now
      };
      sessionRequestCounts.set(sessionId, sessionData);
    }
    
    // Reset counters if windows have passed
    if (sessionData.firstRequest < windowStart) {
      sessionData.count = 0;
      sessionData.firstRequest = now;
    }
    
    if (sessionData.lastBurstReset < burstWindowStart) {
      sessionData.burstCount = 0;
      sessionData.lastBurstReset = now;
    }
    
    // Check burst limit first (shorter window, higher limit)
    if (sessionData.burstCount >= burstLimit) {
      console.warn(`[Rate Limit] Session ${sessionId} exceeded burst limit: ${sessionData.burstCount}/${burstLimit} in last minute`);
      return res.status(429).json({ 
        success: false,
        error: 'Rate limit exceeded', 
        code: 'BURST_LIMIT_EXCEEDED',
        message: `Too many requests in short time. Limit: ${burstLimit} per minute`,
        details: {
          burstLimit,
          burstWindow: '1 minute',
          suggestion: 'Please wait a moment before making more requests'
        },
        retryAfter: Math.ceil((burstWindowMs - (now - sessionData.lastBurstReset)) / 1000)
      });
    }
    
    // Check hourly limit
    if (sessionData.count >= maxRequests) {
      console.warn(`[Rate Limit] Session ${sessionId} exceeded hourly limit: ${sessionData.count}/${maxRequests}`);
      return res.status(429).json({ 
        success: false,
        error: 'Rate limit exceeded',
        code: 'HOURLY_LIMIT_EXCEEDED', 
        message: `Too many requests per hour. Limit: ${maxRequests} per hour`,
        details: {
          hourlyLimit: maxRequests,
          currentCount: sessionData.count,
          windowMs,
          suggestion: 'Please wait before making more requests or contact support if you need higher limits'
        },
        retryAfter: Math.ceil((windowMs - (now - sessionData.firstRequest)) / 1000)
      });
    }
    
    // Increment counters
    sessionData.count++;
    sessionData.burstCount++;
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - sessionData.count),
      'X-RateLimit-Reset': new Date(sessionData.firstRequest + windowMs).toISOString(),
      'X-RateLimit-Burst-Limit': burstLimit,
      'X-RateLimit-Burst-Remaining': Math.max(0, burstLimit - sessionData.burstCount)
    });
    
    next();
  };
};

const axios = require('axios');

// Service to send links to the ML model and get verdicts
exports.analyzeLinks = async (links) => {
  try {
    // Check if ML service URL is configured and if we should use external service
    if (process.env.ML_SERVICE_URL && process.env.USE_EXTERNAL_ML === 'true') {
      console.log(`Sending ${links.length} links to ML service: ${process.env.ML_SERVICE_URL}`);
      
      const response = await axios.post(process.env.ML_SERVICE_URL, { links }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.data; // Expecting { verdicts: [...] }
    } else {
      // Use built-in simulation by default
      console.log(`Analyzing ${links.length} links using built-in ML simulation`);
      return createSafeDefaults(links);
    }
    
  } catch (error) {
    console.error('Error communicating with ML service:', error.message);
    
    // Return built-in simulation instead of throwing error
    console.log('Falling back to built-in ML simulation');
    return createSafeDefaults(links);
  }
};

// Create realistic verdicts using built-in simulation
function createSafeDefaults(links) {
  const verdicts = links.map(url => {
    // Simulate realistic risk assessment based on URL characteristics
    const risk = simulateRiskAssessment(url);
    
    return {
      url: url,
      isMalicious: risk.isMalicious,
      anomalyScore: risk.anomalyScore,
      classificationScore: risk.classificationScore,
      intelMatch: risk.intelMatch
    };
  });
  
  return { verdicts };
}

// Simulate risk assessment based on URL patterns (for demonstration/testing)
function simulateRiskAssessment(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    const params = urlObj.search.toLowerCase();
    
    // High risk indicators
    const highRiskPatterns = [
      /bit\.ly|tinyurl|t\.co|short\.link|su\.pr|goo\.gl/i, // URL shorteners (including goo.gl)
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,              // IP addresses
      /[0-9]{10,}/,                                       // Suspicious long numbers
      /download|click|free|prize|winner|urgent|phishing|scam/i, // Suspicious keywords
      /\.tk$|\.ml$|\.ga$|\.cf$|\.cc$/i                   // Suspicious TLDs
    ];
    
    // Medium risk indicators  
    const mediumRiskPatterns = [
      /[a-z]{15,}/i,                                      // Very long subdomains
      /\-[a-z]{10,}/i,                                    // Long hyphens
      /suspicious|fake|fraud|malware|virus/i,             // Obviously bad keywords
      /\.onion|\.tor/i,                                   // Dark web domains
      /[0-9]{6,}\.com/i,                                  // Numeric domains
      /temp-|test-|staging-|dev-/i                        // Temporary-looking domains
    ];
    
    // Low risk indicators
    const lowRiskPatterns = [
      /[0-9a-f]{32,}/i,                                   // Hash-like patterns
      /temp|test|staging|dev/i,                           // Temporary domains
      /[a-z]{5,}\d{3,}/i,                                // Mixed alphanumeric
      /redirect|proxy|gateway/i                           // Redirect services
    ];
    
    let anomalyScore = 0.1; // Base safe score
    let isMalicious = false;
    let reason = 'URL analysis - appears safe';
    
    // Check high risk patterns
    for (const pattern of highRiskPatterns) {
      if (pattern.test(url)) {
        anomalyScore = Math.random() * 0.3 + 0.7; // 0.7-1.0
        isMalicious = anomalyScore > 0.85;
        reason = 'High-risk pattern detected';
        break;
      }
    }
    
    // Check medium risk patterns if not already high risk
    if (anomalyScore < 0.5) {
      for (const pattern of mediumRiskPatterns) {
        if (pattern.test(url)) {
          anomalyScore = Math.random() * 0.3 + 0.4; // 0.4-0.7
          reason = 'Medium-risk pattern detected';
          break;
        }
      }
    }
    
    // Check low risk patterns if still safe
    if (anomalyScore < 0.3) {
      for (const pattern of lowRiskPatterns) {
        if (pattern.test(url)) {
          anomalyScore = Math.random() * 0.2 + 0.3; // 0.3-0.5
          reason = 'Low-risk indicators found';
          break;
        }
      }
    }
    
    // Add some randomness for realistic assessment
    if (anomalyScore < 0.3) {
      // For unknown domains, add slight randomness
      const randomFactor = Math.random() * 0.25; // 0-0.25
      anomalyScore += randomFactor;
      
      if (randomFactor > 0.15) {
        reason = 'Unknown domain - moderate caution advised';
      }
    }
    
    return {
      isMalicious,
      anomalyScore: Math.round(anomalyScore * 100) / 100, // Round to 2 decimals
      classificationScore: Math.round((1 - anomalyScore) * 100) / 100,
      intelMatch: `Simulated analysis: ${reason}`
    };
    
  } catch (error) {
    // Fallback for invalid URLs
    return {
      isMalicious: false,
      anomalyScore: 0.2,
      classificationScore: 0.8,
      intelMatch: 'URL parsing failed - safe default'
    };
  }
}

const axios = require('axios');

// ==============================
// ML SERVICE INTEGRATION
// ==============================
// Connects to the Bridge API which handles communication with both
// the JavaScript scanner and Python ML services

// Default configuration
const DEFAULT_ML_URL = "";
const DEFAULT_TIMEOUT = 120000; // 120 seconds (2 minutes) for ML processing

// Service to send links to the ML model and get verdicts
exports.analyzeLinks = async (links) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_URL;
  const timeout = parseInt(process.env.ML_TIMEOUT) || DEFAULT_TIMEOUT;

  
  try {
    console.log(`[ML Service] Analyzing ${links.length} links via Bridge API: ${mlServiceUrl}`);
    
    const response = await axios.post(mlServiceUrl, { urls: links }, {
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    // Expecting response.data.results (array of ML verdicts)
    if (response.data && Array.isArray(response.data.results)) {
      // Map each result to the expected format for the rest of the backend
      const verdicts = response.data.results.map(result => ({
        url: result.url,
        final_verdict: result.final_verdict,
        confidence_score: result.confidence_score,
        anomaly_risk_level: result.anomaly_risk_level,
        explanation: result.explanation,
        tip: result.tip,
        features: result.features,
        anomaly_score: result.anomaly_score
      }));
      console.log(`[ML Service] ✅ Successfully analyzed ${verdicts.length} links`);
      return { verdicts };
    } else {
      throw new Error('Invalid response format from ML service');
    }
    
  } catch (error) {
    console.error('[ML Service] ❌ Error communicating with ML service:', error.message);
    
    // Return error response instead of fallback simulation
    throw new Error(`ML service unavailable: ${error.message}`);
  }
};

// ==============================
// HEALTH CHECK
// ==============================
// Check if the ML services are available
exports.checkHealth = async () => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_URL;
  const healthUrl = mlServiceUrl.replace('/analyze', '/health');
  
  try {
    const response = await axios.get(healthUrl, { timeout: 5000 });
    return {
      status: 'healthy',
      url: mlServiceUrl,
      details: response.data
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      url: mlServiceUrl,
      error: error.message
    };
  }
};

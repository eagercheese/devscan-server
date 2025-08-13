const axios = require('axios');

// ==============================
// ML SERVICE INTEGRATION
// ==============================
// Connects to the Bridge API which handles communication with both
// the JavaScript scanner and Python ML services

// Default configuration
const DEFAULT_ML_URL = 'http://localhost:3001/analyze';
const DEFAULT_TIMEOUT = 60000; // 60 seconds for ML processing

// Service to send links to the ML model and get verdicts
exports.analyzeLinks = async (links) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_URL;
  const timeout = parseInt(process.env.ML_TIMEOUT) || DEFAULT_TIMEOUT;

  
  try {
    console.log(`[ML Service] Analyzing ${links.length} links via Bridge API: ${mlServiceUrl}`);
    
    const response = await axios.post(mlServiceUrl, { links }, {
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.verdicts) {
      console.log(`[ML Service] ✅ Successfully analyzed ${response.data.verdicts.length} links`);
      return response.data;
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

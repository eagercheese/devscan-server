const axios = require('axios');

// ==============================
// ML SERVICE INTEGRATION WITH RETRY
// ==============================
// Connects to the Bridge API which handles communication with both
// the JavaScript scanner and Python ML services

// Default configuration
const DEFAULT_ML_URL = "http://localhost:8000/extract";
const DEFAULT_TIMEOUT = 90000; // 90 seconds (increased from 30 seconds)
const DEFAULT_RETRY_ATTEMPTS = 2; // Keep at 2
const DEFAULT_RETRY_DELAY = 2000; // 2 seconds (increased from 1 second)

// Utility function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Service to send links to the ML model and get verdicts with retry logic
exports.analyzeLinks = async (links) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_URL;
  const timeout = parseInt(process.env.ML_TIMEOUT) || DEFAULT_TIMEOUT;
  const maxRetries = parseInt(process.env.ML_RETRY_ATTEMPTS) || DEFAULT_RETRY_ATTEMPTS;
  const retryDelay = parseInt(process.env.ML_RETRY_DELAY) || DEFAULT_RETRY_DELAY;

  // Quick pre-check for obviously problematic URLs
  const problematicPatterns = [
    /test123unique\.com/i,
    /localhost:\d+/i,
    /127\.0\.0\.1/i
  ];
  
  const hasProblematicUrl = links.some(url => 
    problematicPatterns.some(pattern => pattern.test(url))
  );
  
  if (hasProblematicUrl) {
    console.warn(`[ML Service] ⚠️ Detected potentially problematic URL pattern, using reduced retries but longer timeout`);
    // Use only 1 attempt for known problematic URLs but give it more time
    const reducedRetries = 1;
    const extendedTimeout = timeout * 1.5; // 50% longer timeout for problematic URLs
    return await performAnalysisWithRetry(links, mlServiceUrl, extendedTimeout, reducedRetries, retryDelay);
  }

  return await performAnalysisWithRetry(links, mlServiceUrl, timeout, maxRetries, retryDelay);
};

// Helper function to perform the actual analysis with retry logic
async function performAnalysisWithRetry(links, mlServiceUrl, timeout, maxRetries, retryDelay) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ML Service] Attempt ${attempt}/${maxRetries}: Analyzing ${links.length} links via Bridge API: ${mlServiceUrl}`);
      
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
        console.log(`[ML Service] ✅ Successfully analyzed ${verdicts.length} links on attempt ${attempt}`);
        return { verdicts };
      } else {
        throw new Error('Invalid response format from ML service');
      }
      
    } catch (error) {
      lastError = error;
      
      // Quick fail for certain types of errors
      if (error.response && error.response.status === 500) {
        console.error(`[ML Service] ❌ Server error (500) for request - not retrying: ${error.message}`);
        break; // Don't retry on 500 errors as they're likely code issues
      }
      
      console.error(`[ML Service] ❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // If this is the last attempt, don't wait
      if (attempt < maxRetries) {
        console.log(`[ML Service] ⏳ Waiting ${retryDelay}ms before retry...`);
        await delay(retryDelay);
      }
    }
  }
  
  // All retries failed, throw the last error
  console.error(`[ML Service] 💥 All ${maxRetries} attempts failed. Last error:`, lastError.message);
  throw new Error(`ML service unavailable after ${maxRetries} attempts: ${lastError.message}`);
}

// Service to analyze individual links with fallback
exports.analyzeLinkWithFallback = async (url) => {
  try {
    const result = await exports.analyzeLinks([url]);
    return result.verdicts[0] || null;
  } catch (error) {
    console.warn(`[ML Service] 🔄 Individual retry for ${url} failed, returning fallback verdict`);
    return {
      url: url,
      final_verdict: 'Scan Failed',
      confidence_score: '0%',
      anomaly_risk_level: 'Unknown',
      explanation: 'Unable to analyze this link due to service issues. Please try again later.',
      tip: 'The scanning service is temporarily unavailable. Exercise caution.',
      features: {},
      anomaly_score: 0
    };
  }
};

// ==============================
// HEALTH CHECK
// ==============================
// Check if the ML services are available
exports.checkHealth = async () => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || DEFAULT_ML_URL;
  const healthUrl = mlServiceUrl.replace('/extract', '/');
  
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

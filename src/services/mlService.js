const axios = require('axios');

// Service to send links to the ML model and get verdicts
exports.analyzeLinks = async (links) => {
  try {
    const response = await axios.post(process.env.ML_SERVICE_URL, { links });
    return response.data; // Expecting { verdicts: [...] }
  } catch (error) {
    console.error('Error communicating with ML service:', error);
    throw new Error('ML service error');
  }
};

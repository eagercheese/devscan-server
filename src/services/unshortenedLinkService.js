// src/services/unshortenedlinkService.js
const fetch = require('node-fetch');

exports.unshortenedLinkService = async (targetUrl) => {
  try {
    // Perform a HEAD request to get the unshortened URL
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'
      }
    });

    // Return the unshortened URL
    return { success: true, url: response.url };
    
  } catch (error) {
    console.error('Error resolving URL:', error.message);
    return { success: false, message: 'Failed to resolve URL' };
  }
};

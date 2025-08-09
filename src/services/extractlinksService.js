// src/services/linkExtractor.service.js
const axios = require('axios');
const cheerio = require('cheerio');

exports.extractLinksFromUrl = async (targetUrl) => {
  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000, // 10 seconds
      headers: { 'User-Agent': 'DEVScan-Server/1.0' }
    });

    const $ = cheerio.load(response.data);
    const links = [];

    // Map selector → attribute to extract
    const selectorAttrMap = {
      "a[href]": "href",
      "link[href]": "href",
      "iframe[src]": "src",
      "frame[src]": "src",
      "script[src]": "src",
      "form[action]": "action",
      "button[onclick]": "onclick",
      "[onclick*='http']": "onclick",
      "[data-href]": "data-href"
    };

    for (const [selector, attr] of Object.entries(selectorAttrMap)) {
      $(selector).each((_, element) => {
        let value = $(element).attr(attr);

        if (value) {
          try {
            // Handle JS onclick URLs like window.location='...'
            if (attr === "onclick" && value.includes("http")) {
              const match = value.match(/https?:\/\/[^\s'"]+/);
              if (match) value = match[0];
            }

            // Convert relative or protocol-relative to absolute
            const absoluteUrl = new URL(value, targetUrl).href;

            if (!links.includes(absoluteUrl)) {
              links.push(absoluteUrl);
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      });
    }

    return { success: true, links };
  } catch (error) {
    console.error(`[LinkExtractor] Error fetching ${targetUrl}:`, error.message);
    return { success: false, error: error.message, links: [] };
  }
};

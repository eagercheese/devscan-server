// ==============================
// OPTIMIZED WHITELIST SERVICE
// ==============================
// Combined domain safety verification using LOCAL Tranco rankings and manual whitelist
// Only domains ranked 1-1000 in Tranco or manually whitelisted are considered safe
// All other domains are passed to the machine learning model for analysis

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class WhitelistService {
  constructor() {
    // ==============================
    // CONFIGURATION
    // ==============================
    this.trancoSet = new Set(); // Fast O(1) lookups for top 1K domains
    this.safeRankThreshold = 1000; // Only top 1K domains are safe
    this.trancoFilePath = path.join(__dirname, '../data/top-1m.csv');
    
    // Manual whitelist for well-known safe domains
    this.manualWhitelist = new Set([
      'google.com',
      'microsoft.com',
      'apple.com',
      'github.com',
      'stackoverflow.com',
      'wikipedia.org'
    ]);
    
    console.log(`[WhitelistService] Initializing with threshold: Top ${this.safeRankThreshold} domains`);
    this.loadTrancoData();
  }

  // ==============================
  // TRANCO DATA LOADING
  // ==============================

  loadTrancoData() {
    try {
      console.log('[WhitelistService] Loading Tranco domains from file...');
      
      const results = new Set();
      let count = 0;
      
      fs.createReadStream(this.trancoFilePath)
        .pipe(csv({ headers: ['rank', 'domain'] }))
        .on('data', (row) => {
          const rank = parseInt(row.rank);
          const domain = row.domain?.trim();
          
          // Only store domains within our safe threshold
          if (domain && rank >= 1 && rank <= this.safeRankThreshold) {
            results.add(domain.toLowerCase()); // Normalize to lowercase
            count++;
          }
        })
        .on('end', () => {
          this.trancoSet = results;
          console.log(`[WhitelistService] Loaded ${count} safe domains (ranks 1-${this.safeRankThreshold})`);
        })
        .on('error', (error) => {
          console.error('[WhitelistService] Error loading Tranco file:', error);
          this.trancoSet = new Set(); // Fallback to empty set
        });
        
    } catch (error) {
      console.error('[WhitelistService] Failed to initialize Tranco data:', error);
      this.trancoSet = new Set(); // Fallback to empty set
    }
  }

  // ==============================
  // CORE WHITELIST FUNCTIONALITY
  // ==============================

  /**
   * Extract domain from URL for whitelist checking
   * @param {string} url - The URL to extract domain from
   * @returns {string} The domain
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase(); // Remove www. and normalize
    } catch (error) {
      console.error('Error extracting domain from URL:', url, error);
      return null;
    }
  }

  /**
   * Check if domain is in manual whitelist
   * @param {string} domain - Domain to check
   * @returns {boolean} True if whitelisted
   */
  isManuallyWhitelisted(domain) {
    return this.manualWhitelist.has(domain);
  }

  /**
   * Check if domain is in Tranco top 1K (instant O(1) lookup)
   * @param {string} domain - Domain to check
   * @returns {boolean} True if in top 1K
   */
  isTrancoSafe(domain) {
    return this.trancoSet.has(domain);
  }

  /**
   * Main whitelist check function (INSTANT!)
   * @param {string} url - URL to check
   * @returns {Object} Whitelist check result
   */
  checkWhitelist(url) {
    const domain = this.extractDomain(url);
    
    if (!domain) {
      return {
        isWhitelisted: false,
        reason: 'invalid_url',
        domain: null,
        source: null
      };
    }

    // Check manual whitelist first
    if (this.isManuallyWhitelisted(domain)) {
      return {
        isWhitelisted: true,
        reason: 'manual_whitelist',
        domain: domain,
        source: 'manual'
      };
    }

    // Check Tranco top 1K (instant lookup)
    if (this.isTrancoSafe(domain)) {
      return {
        isWhitelisted: true,
        reason: 'tranco_safe_rank',
        domain: domain,
        source: 'local_tranco',
        rank: '1-1000',
        threshold: this.safeRankThreshold
      };
    }

    // Not whitelisted - will be processed by ML model
    return {
      isWhitelisted: false,
      reason: 'not_in_safe_rankings',
      domain: domain,
      source: 'local_tranco',
      rank: null,
      threshold: this.safeRankThreshold,
      willGoToML: true
    };
  }
}

module.exports = new WhitelistService();

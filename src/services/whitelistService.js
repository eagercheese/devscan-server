// ==============================
// WHITELIST SERVICE
// ==============================
// Domain safety verification using Tranco rankings and manual whitelist
// Only domains ranked 1-1000 in Tranco or manually whitelisted are considered safe
// All other domains are passed to the machine learning model for analysis

const fetch = require('node-fetch');

class WhitelistService {
  constructor() {
    // ==============================
    // CONFIGURATION
    // ==============================
    this.trancoApiBase = 'https://tranco-list.eu/api';
    this.cache = new Map(); // Cache results to avoid repeated API calls
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Manual whitelist for well-known safe domains (only the most essential ones)
    this.manualWhitelist = new Set([
      'google.com',
      'microsoft.com',
      'apple.com',
      'github.com',
      'stackoverflow.com',
      'wikipedia.org'
      // Removed Facebook and other social media to test properly
    ]);
    
    // Tranco safety threshold: Only domains ranked 1-1000 are considered safe
    // Any domain with rank > 1000 or unranked will be passed to ML model
    // Lower rank number = more popular/trusted (rank 1 = most popular)
    this.safeRankThreshold = 1000; // ONLY Top 1,000 domains considered safe
    
    console.log(`[WhitelistService] Initialized with Tranco safety threshold: Top ${this.safeRankThreshold} domains`);
  }

  // ==============================
  // UTILITY METHODS
  // ==============================

  /**
   * Extract domain from URL for whitelist checking
   * @param {string} url - The URL to extract domain from
   * @returns {string} The domain
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix
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
    return this.manualWhitelist.has(domain.toLowerCase());
  }

  // ==============================
  // TRANCO API INTEGRATION
  // ==============================

  /**
   * Check domain against Tranco API with caching
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} Tranco check result
   */
  async checkTrancoRank(domain) {
    const cacheKey = `tranco_${domain}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached result if still valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      console.log(`Using cached Tranco result for ${domain}`);
      return cached.data;
    }

    try {
      console.log(`Checking Tranco rank for domain: ${domain}`);
      
      const response = await fetch(`${this.trancoApiBase}/ranks/domain/${domain}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'DEVScan-Security-Extension/1.0'
        },
        timeout: 5000 // 5 second timeout
      });

      if (response.status === 200) {
        const data = await response.json();
        const result = {
          found: data.ranks && data.ranks.length > 0,
          ranks: data.ranks || [],
          latestRank: data.ranks && data.ranks.length > 0 ? data.ranks[0].rank : null,
          isSafe: false
        };

        // Determine if domain is safe based on latest rank
        // ONLY ranks 1-1000 are considered safe, everything else goes to ML model
        if (result.latestRank && result.latestRank >= 1 && result.latestRank <= this.safeRankThreshold) {
          result.isSafe = true;
          console.log(`[WhitelistService] Domain ${domain} is SAFE - Tranco rank ${result.latestRank} (within top ${this.safeRankThreshold})`);
        } else if (result.latestRank) {
          result.isSafe = false;
          console.log(`[WhitelistService] Domain ${domain} will go to ML - Tranco rank ${result.latestRank} (exceeds safe threshold of ${this.safeRankThreshold})`);
        } else {
          result.isSafe = false;
          console.log(`[WhitelistService] Domain ${domain} will go to ML - no valid Tranco rank found`);
        }

        // Cache the result
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        console.log(`Tranco check for ${domain}: Rank ${result.latestRank}, Safe: ${result.isSafe}`);
        return result;

      } else if (response.status === 404) {
        // Domain not found in Tranco (not necessarily malicious, just not ranked)
        const result = { found: false, ranks: [], latestRank: null, isSafe: false };
        
        // Cache negative result too
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        console.log(`Domain ${domain} not found in Tranco rankings - will go to ML model`);
        return result;

      } else if (response.status === 429) {
        console.warn(`Tranco API rate limit exceeded for ${domain}`);
        return { found: false, ranks: [], latestRank: null, isSafe: false, rateLimited: true };

      } else {
        console.error(`Tranco API error for ${domain}: ${response.status} ${response.statusText}`);
        return { found: false, ranks: [], latestRank: null, isSafe: false, error: true };
      }

    } catch (error) {
      console.error(`Error checking Tranco for ${domain}:`, error.message);
      return { found: false, ranks: [], latestRank: null, isSafe: false, error: true };
    }
  }

  /**
   * Main whitelist check function
   * @param {string} url - URL to check
   * @returns {Promise<Object>} Whitelist check result
   */
  async checkWhitelist(url) {
    const domain = this.extractDomain(url);
    
    if (!domain) {
      return {
        isWhitelisted: false,
        reason: 'invalid_url',
        domain: null,
        source: null
      };
    }

    // Check manual whitelist first (fastest)
    if (this.isManuallyWhitelisted(domain)) {
      console.log(`Domain ${domain} found in manual whitelist`);
      return {
        isWhitelisted: true,
        reason: 'manual_whitelist',
        domain: domain,
        source: 'manual'
      };
    }

    // Check Tranco API
    const trancoResult = await this.checkTrancoRank(domain);
    
    if (trancoResult.isSafe) {
      console.log(`[WhitelistService] Domain ${domain} WHITELISTED via Tranco (rank: ${trancoResult.latestRank} <= ${this.safeRankThreshold})`);
      return {
        isWhitelisted: true,
        reason: 'tranco_safe_rank',
        domain: domain,
        source: 'tranco',
        rank: trancoResult.latestRank,
        threshold: this.safeRankThreshold
      };
    }

    // Not whitelisted - will be processed by ML model
    const reason = trancoResult.found ? 
      (trancoResult.latestRank > this.safeRankThreshold ? 'rank_exceeds_safe_threshold' : 'rank_too_low') : 
      'not_ranked';
    
    console.log(`[WhitelistService] Domain ${domain} NOT WHITELISTED - will go to ML model (reason: ${reason}, rank: ${trancoResult.latestRank || 'none'})`);
    return {
      isWhitelisted: false,
      reason: reason,
      domain: domain,
      source: 'tranco',
      rank: trancoResult.latestRank,
      threshold: this.safeRankThreshold,
      willGoToML: true
    };
  }

  /**
   * Bulk whitelist check for multiple URLs
   * @param {string[]} urls - Array of URLs to check
   * @returns {Promise<Object[]>} Array of whitelist results
   */
  async checkWhitelistBulk(urls) {
    console.log(`Checking whitelist for ${urls.length} URLs`);
    
    const results = await Promise.all(
      urls.map(async (url) => {
        const result = await this.checkWhitelist(url);
        return { url, ...result };
      })
    );

    const whitelistedCount = results.filter(r => r.isWhitelisted).length;
    console.log(`Whitelist check complete: ${whitelistedCount}/${urls.length} URLs whitelisted`);
    
    return results;
  }

  /**
   * Add domain to manual whitelist
   * @param {string} domain - Domain to add
   */
  addToManualWhitelist(domain) {
    this.manualWhitelist.add(domain.toLowerCase());
    console.log(`Added ${domain} to manual whitelist`);
  }

  /**
   * Remove domain from manual whitelist
   * @param {string} domain - Domain to remove
   */
  removeFromManualWhitelist(domain) {
    this.manualWhitelist.delete(domain.toLowerCase());
    console.log(`Removed ${domain} from manual whitelist`);
  }

  /**
   * Get whitelist statistics
   * @returns {Object} Statistics about whitelist usage
   */
  getStats() {
    return {
      manualWhitelistSize: this.manualWhitelist.size,
      cacheSize: this.cache.size,
      safeRankThreshold: this.safeRankThreshold,
      cacheExpiryHours: this.cacheExpiry / (60 * 60 * 1000),
      rangeDescription: `Only Tranco ranks 1-${this.safeRankThreshold} are considered safe`,
      mlProcessingNote: `Ranks > ${this.safeRankThreshold} and unranked domains go to ML model`
    };
  }

  /**
   * Get detailed statistics about recent whitelist decisions
   * @returns {Object} Detailed statistics
   */
  getDetailedStats() {
    const cacheEntries = Array.from(this.cache.values());
    const trancoResults = cacheEntries
      .map(entry => entry.data)
      .filter(data => data.found);
    
    const safeCount = trancoResults.filter(data => data.isSafe).length;
    const unsafeCount = trancoResults.filter(data => !data.isSafe && data.found).length;
    const unrankedCount = cacheEntries.filter(entry => !entry.data.found).length;
    
    return {
      ...this.getStats(),
      trancoStats: {
        totalChecked: cacheEntries.length,
        safeRanked: safeCount,
        unsafeRanked: unsafeCount,
        unranked: unrankedCount,
        safePercentage: cacheEntries.length > 0 ? ((safeCount / cacheEntries.length) * 100).toFixed(1) : 0,
        mlProcessingPercentage: cacheEntries.length > 0 ? (((unsafeCount + unrankedCount) / cacheEntries.length) * 100).toFixed(1) : 0
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Whitelist cache cleared');
  }
}

module.exports = new WhitelistService();

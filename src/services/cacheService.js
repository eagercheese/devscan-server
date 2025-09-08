// Lazy load database models to avoid startup crashes
let CachedResults, ScannedLink, ScanResults, sequelize, Sequelize;
let modelsLoaded = false;

function loadModels() {
  if (!modelsLoaded) {
    try {
      CachedResults = require('../models/CachedResults');
      ScannedLink = require('../models/ScannedLink');
      ScanResults = require('../models/ScanResults');
      sequelize = require('../models/index');
      Sequelize = require('sequelize');
      modelsLoaded = true;
      console.log('[CacheService] 📚 Database models loaded successfully');
    } catch (error) {
      console.warn('[CacheService] ⚠️ Could not load database models:', error.message);
      modelsLoaded = false;
    }
  }
  return modelsLoaded;
}

// In-memory fallback cache when database is unavailable
const memoryCache = new Map();
const urlCache = new Map(); // Direct URL-based cache for single scans
const MEMORY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const URL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for URL-based cache
let isDatabaseAvailable = null;

// Test database connection
async function testDatabaseConnection() {
  if (isDatabaseAvailable !== null) {
    return isDatabaseAvailable;
  }

  if (!loadModels()) {
    isDatabaseAvailable = false;
    return false;
  }

  try {
    await sequelize.authenticate();
    console.log('[CacheService] ✅ Database connection established');
    isDatabaseAvailable = true;
    return true;
  } catch (error) {
    console.warn('[CacheService] ⚠️ Database unavailable, using memory cache only:', error.message);
    isDatabaseAvailable = false;
    return false;
  }
}

// Move expired cached results to deleted_cached_links and delete from cached_results
exports.cleanExpiredCache = async () => {
  const dbAvailable = await testDatabaseConnection();
  if (dbAvailable) {
    try {
      // Move expired cache to deleted_cached_links
      await sequelize.query(`
        INSERT INTO deleted_cached_links (url, final_verdict, confidence_score, anomaly_risk_level, explanation, tip, cacheSource, lastScanned, expiresAt)
        SELECT url, final_verdict, confidence_score, anomaly_risk_level, explanation, tip, cacheSource, lastScanned, expiresAt
        FROM cached_results
        WHERE expiresAt < NOW();
      `);
      // Delete expired cache
      const [result] = await sequelize.query(`
        DELETE FROM cached_results WHERE expiresAt < NOW();
      `);
      console.log(`[CacheService] 🧹 Moved and deleted expired cache entries`);
      return result;
    } catch (error) {
      console.warn('[CacheService] Failed to clean expired cache:', error.message);
    }
  }
  return 0;
};

// Check cache for a link by URL (primary method)
// URL normalization helper function
function normalizeUrlForCache(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    // Parse URL to get components
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    // Normalize: https protocol, remove www prefix, lowercase, remove trailing slash
    let normalized = `https://${urlObj.hostname.replace(/^www\./, '').toLowerCase()}${urlObj.pathname}`;
    
    // Remove trailing slash unless it's just the domain
    if (urlObj.pathname !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Add query parameters back if they exist
    if (urlObj.search) {
      normalized += urlObj.search;
    }
    
    return normalized;
  } catch (e) {
    // Fallback: basic normalization
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

// Generate multiple URL variants for cache lookup
function generateUrlVariants(url) {
  const variants = new Set();
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname;
    const search = urlObj.search || '';
    
    // Add original URL
    variants.add(url);
    
    // Add normalized version
    variants.add(normalizeUrlForCache(url));
    
    // Add with/without www variants
    const domainWithoutWww = domain.replace(/^www\./, '');
    const domainWithWww = domainWithoutWww.startsWith('www.') ? domainWithoutWww : `www.${domainWithoutWww}`;
    
    // HTTP and HTTPS variants
    for (const protocol of ['http', 'https']) {
      for (const domainVariant of [domainWithoutWww, domainWithWww]) {
        const baseUrl = `${protocol}://${domainVariant}${path}${search}`;
        variants.add(baseUrl);
        
        // Also add without trailing slash
        if (path !== '/' && baseUrl.endsWith('/')) {
          variants.add(baseUrl.slice(0, -1));
        }
        // And with trailing slash
        if (path === '' || (!baseUrl.endsWith('/') && !search)) {
          variants.add(baseUrl + '/');
        }
      }
    }
    
    console.log(`[CacheService] Generated ${variants.size} URL variants for lookup: ${url}`);
    return Array.from(variants);
    
  } catch (e) {
    console.warn(`[CacheService] Failed to generate URL variants for ${url}:`, e.message);
    return [url]; // Return original URL as fallback
  }
}

exports.getCachedResultByUrl = async (url) => {
  // First check the fast in-memory URL cache
  const fastCached = urlCache.get(url);
  if (fastCached && (Date.now() - fastCached.timestamp) < URL_CACHE_TTL) {
    // Fast cache hit - already processed
    return fastCached.data;
  }

  // Then check database cache by URL with enhanced URL matching
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      // Generate multiple URL variants to check (www/non-www, http/https, trailing slashes)
      const urlVariants = generateUrlVariants(url);
      console.log(`[CacheService] Checking cache for ${urlVariants.length} URL variants of: ${url}`);
      
      // Try direct URL lookup for all variants (new format)
      let result = await CachedResults.findOne({
        where: { 
          url: {
            [Sequelize.Op.in]: urlVariants
          },
          expiresAt: {
            [Sequelize.Op.gt]: new Date() // Only get non-expired results
          }
        },
        order: [['lastScanned', 'DESC']],
        limit: 1
      });
      
      // Fallback to join-based lookup for all variants (old format) if no direct URL result
      if (!result) {
        console.log(`[CacheService] No direct URL match, trying join-based lookup for variants`);
        result = await CachedResults.findOne({
          include: [{
            model: ScannedLink,
            where: { 
              url: {
                [Sequelize.Op.in]: urlVariants
              }
            },
            required: true
          }],
          order: [['lastScanned', 'DESC']],
          limit: 1
        });
      }
      
      if (result) {
        // Database cache hit - result found
        const matchedUrl = result.url || (result.ScannedLink ? result.ScannedLink.url : 'unknown');
        console.log(`[CacheService] ✅ Cache HIT for ${url} (matched: ${matchedUrl})`);
        
        // Store in fast cache for next time
        const resultData = {
          final_verdict: result.final_verdict,
          confidence_score: result.confidence_score,
          anomaly_risk_level: result.anomaly_risk_level,
          explanation: result.explanation,
          tip: result.tip,
          cacheSource: result.cacheSource,
          lastScanned: result.lastScanned,
          expiresAt: result.expiresAt,
          cached: true
        };
        urlCache.set(url, {
          data: resultData,
          timestamp: Date.now()
        });
        return resultData;
      } else {
        console.log(`[CacheService] ❌ Cache MISS for ${url} (checked ${urlVariants.length} variants)`);
      }
    } catch (error) {
      console.warn('[CacheService] Database cache failed, using memory fallback:', error.message);
    }
  }
  
  // Memory cache fallback using URL as key
  const cacheKey = `url_${url}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < MEMORY_CACHE_TTL) {
    // Memory cache hit for URL
    return cached.data;
  }
  
  return null;
};

// Check cache for a link by link_ID (legacy method)
exports.getCachedResult = async (link_ID) => {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      const result = await CachedResults.findOne({ where: { link_ID } });
      if (result) {
        return result;
      }
    } catch (error) {
      console.warn('[CacheService] Database cache failed, using memory fallback:', error.message);
    }
  }
  
  // Memory cache fallback using consistent key format
  const cacheKey = `result_${link_ID}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < MEMORY_CACHE_TTL) {
    console.log(`[CacheService] 💾 Memory cache hit for link ${link_ID}`);
    return cached.data;
  }
  
  return null;
};

// ==============================
// FAST URL-BASED CACHE (for single scan endpoint)
// ==============================
// Check cache for a URL result (fastest method)
exports.getCachedResultByUrlFast = (url) => {
  const cached = urlCache.get(url);
  if (cached && (Date.now() - cached.timestamp) < URL_CACHE_TTL) {
    console.log(`[CacheService] ⚡ Fast URL cache hit for ${url}`);
    return cached.data;
  }
  return null;
};

// Store URL result in fast cache
exports.setCachedResultByUrlFast = (url, result) => {
  urlCache.set(url, {
    data: result,
    timestamp: Date.now()
  });
  // Fast cache updated
};

// Store result in cache by URL (primary method)
exports.setCachedResultByUrl = async (url, result) => {
  // Store in fast URL cache immediately
  const resultData = {
    final_verdict: result.final_verdict,
    confidence_score: result.confidence_score,
    anomaly_risk_level: result.anomaly_risk_level,
    explanation: result.explanation,
    tip: result.tip,
    cacheSource: result.cacheSource,
    lastScanned: result.lastScanned,
    expiresAt: result.expiresAt,
    cached: true
  };
  urlCache.set(url, {
    data: resultData,
    timestamp: Date.now()
  });
  // Also store in memory cache using URL as key
  const cacheKey = `url_${url}`;
  memoryCache.set(cacheKey, {
    data: resultData,
    timestamp: Date.now()
  });
  // Memory cache updated
  return resultData;
};

// Store ML analysis result in cache with 7-day expiry
exports.setCachedResult = async (result, url = null) => {
  // Don't cache failed scan results - only cache successful ML analysis (Safe, Anomalous, Malicious)
  const validVerdicts = ['Safe', 'Anomalous', 'Malicious'];
  if (!validVerdicts.includes(result.final_verdict)) {
    console.log(`[CacheService] ⚠️ Skipping cache for non-successful verdict: ${result.final_verdict}`);
    return result; // Return the result without caching
  }

  const dbAvailable = await testDatabaseConnection();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SEVEN_DAYS_MS);
  result.expiresAt = expiresAt;

  if (dbAvailable) {
    try {
      // Validate that the foreign key references exist before inserting
      if (result.results_ID && result.link_ID) {
        const existingResult = await ScanResults.findByPk(result.results_ID);
        const existingLink = await ScannedLink.findByPk(result.link_ID);

        if (existingResult && existingLink) {
          // Get URL from ScannedLink if not provided
          const urlToCache = url || existingLink.url;
          
          // Check if this URL already has a recent cached result to prevent duplicates
          const existingCache = await CachedResults.findOne({
            where: { 
              url: urlToCache,
              final_verdict: result.final_verdict, // Same verdict
              expiresAt: {
                [Sequelize.Op.gt]: new Date() // Still valid
              }
            },
            order: [['lastScanned', 'DESC']]
          });

          if (existingCache) {
            console.log(`[CacheService] ⚠️ Duplicate cache entry prevented for ${urlToCache} with verdict ${result.final_verdict}`);
            return existingCache; // Return existing cache instead of creating duplicate
          }
          
          const cacheData = {
            ...result,
            url: urlToCache // Add URL to new records, will be null for existing records
          };
          
          // Try to create the cached result, fall back gracefully if URL constraint fails
          try {
            const cached = await CachedResults.create(cacheData);
            console.log(`[CacheService] ✅ Stored result in database cache for ${urlToCache} (link ${result.link_ID})`);

            // Also store in memory cache for faster access
            const cacheKey = `result_${result.link_ID}`;
            memoryCache.set(cacheKey, {
              data: cached,
              timestamp: Date.now()
            });

            return cached;
          } catch (createError) {
            // If URL constraint fails, try without URL (backward compatibility)
            if (createError.message.includes('url')) {
              console.warn('[CacheService] ⚠️ URL field not supported, storing without URL');
              const cacheDataWithoutUrl = { ...result };
              delete cacheDataWithoutUrl.url;
              
              const cached = await CachedResults.create(cacheDataWithoutUrl);
              console.log(`[CacheService] ✅ Stored result in database cache (no URL) for link ${result.link_ID}`);
              
              const cacheKey = `result_${result.link_ID}`;
              memoryCache.set(cacheKey, {
                data: cached,
                timestamp: Date.now()
              });
              return cached;
            } else {
              throw createError;
            }
          }
        } else {
          console.warn(`[CacheService] ⚠️ Foreign key validation failed - ScanResult: ${!!existingResult}, ScannedLink: ${!!existingLink}`);
          throw new Error('Foreign key references do not exist');
        }
      } else {
        console.warn('[CacheService] ⚠️ Missing required IDs for database cache');
        throw new Error('Missing results_ID or link_ID');
      }
    } catch (error) {
      console.warn('[CacheService] Database cache failed, using memory cache:', error.message);
    }
  }

  // Memory cache fallback (always works)
  const cacheKey = `result_${result.link_ID}`;
  memoryCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  console.log(`[CacheService] 💾 Stored result in memory cache for link ${result.link_ID}`);
  return result;
};

// Clean up failed scan results from cache (should not be cached)
exports.cleanupFailedScans = async () => {
  const dbAvailable = await testDatabaseConnection();
  if (!dbAvailable) {
    console.log('[CacheService] 💾 Database unavailable, cleaning memory cache only');
    // Clean memory cache
    for (const [key, cached] of memoryCache.entries()) {
      if (cached.data && cached.data.final_verdict === 'Scan Failed') {
        memoryCache.delete(key);
        console.log(`[CacheService] 🗑️ Removed failed scan from memory cache: ${key}`);
      }
    }
    for (const [key, cached] of urlCache.entries()) {
      if (cached.data && cached.data.final_verdict === 'Scan Failed') {
        urlCache.delete(key);
        console.log(`[CacheService] 🗑️ Removed failed scan from URL cache: ${key}`);
      }
    }
    return;
  }

  try {
    // Remove failed scan results from database cache
    const deletedCount = await CachedResults.destroy({
      where: {
        final_verdict: 'Scan Failed'
      }
    });
    
    if (deletedCount > 0) {
      console.log(`[CacheService] 🗑️ Cleaned up ${deletedCount} failed scan cache entries from database`);
    }
    
    // Also clean memory caches
    for (const [key, cached] of memoryCache.entries()) {
      if (cached.data && cached.data.final_verdict === 'Scan Failed') {
        memoryCache.delete(key);
      }
    }
    for (const [key, cached] of urlCache.entries()) {
      if (cached.data && cached.data.final_verdict === 'Scan Failed') {
        urlCache.delete(key);
      }
    }
    
  } catch (error) {
    console.error('[CacheService] Error cleaning up failed scans:', error);
  }
};



// Lazy load database models to avoid startup crashes
let CachedResults, ScannedLink, ScanResults, sequelize;
let modelsLoaded = false;

function loadModels() {
  if (!modelsLoaded) {
    try {
      CachedResults = require('../models/CachedResults');
      ScannedLink = require('../models/ScannedLink');
      ScanResults = require('../models/ScanResults');
      sequelize = require('../models/index');
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

// Check cache for a link by URL (primary method)
exports.getCachedResultByUrl = async (url) => {
  // First check the fast in-memory URL cache
  const fastCached = urlCache.get(url);
  if (fastCached && (Date.now() - fastCached.timestamp) < URL_CACHE_TTL) {
    console.log(`[CacheService] ⚡ Fast URL cache hit for ${url}`);
    return fastCached.data;
  }

  // Then check database cache by URL
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      // Find the most recent scan result for this URL
      const result = await CachedResults.findOne({
        include: [{
          model: ScannedLink,
          where: { url: url },
          required: true
        }],
        order: [['createdAt', 'DESC']],
        limit: 1
      });
      
      if (result) {
        console.log(`[CacheService] 🗄️ Database cache hit for ${url}`);
        // Store in fast cache for next time
        const resultData = {
          isMalicious: result.isMalicious,
          anomalyScore: result.anomalyScore,
          classificationScore: result.classificationScore,
          intelMatch: result.intelMatch,
          cached: true
        };
        urlCache.set(url, {
          data: resultData,
          timestamp: Date.now()
        });
        return resultData;
      }
    } catch (error) {
      console.warn('[CacheService] Database cache failed, using memory fallback:', error.message);
    }
  }
  
  // Memory cache fallback using URL as key
  const cacheKey = `url_${url}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < MEMORY_CACHE_TTL) {
    console.log(`[CacheService] 💾 Memory cache hit for URL ${url}`);
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
  console.log(`[CacheService] ⚡ Stored result in fast URL cache for ${url}`);
};

// Store result in cache by URL (primary method)
exports.setCachedResultByUrl = async (url, result) => {
  // Store in fast URL cache immediately
  const resultData = {
    isMalicious: result.isMalicious,
    anomalyScore: result.anomalyScore,
    classificationScore: result.classificationScore,
    intelMatch: result.intelMatch,
    cached: true,
    whitelisted: result.whitelisted || false
  };
  
  urlCache.set(url, {
    data: resultData,
    timestamp: Date.now()
  });
  console.log(`[CacheService] ⚡ Stored result in fast URL cache for ${url}`);
  
  // Also store in memory cache using URL as key
  const cacheKey = `url_${url}`;
  memoryCache.set(cacheKey, {
    data: resultData,
    timestamp: Date.now()
  });
  console.log(`[CacheService] 💾 Stored result in memory cache for URL ${url}`);
  
  return resultData;
};

// Store ML analysis result in cache
exports.setCachedResult = async (result) => {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      // Validate that the foreign key references exist before inserting
      if (result.results_ID && result.link_ID) {
        const existingResult = await ScanResults.findByPk(result.results_ID);
        const existingLink = await ScannedLink.findByPk(result.link_ID);
        
        if (existingResult && existingLink) {
          const cached = await CachedResults.create(result);
          console.log(`[CacheService] ✅ Stored result in database cache for link ${result.link_ID}\n`);
          
          // Also store in memory cache for faster access
          const cacheKey = `result_${result.link_ID}`;
          memoryCache.set(cacheKey, {
            data: cached,
            timestamp: Date.now()
          });
          
          return cached;
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



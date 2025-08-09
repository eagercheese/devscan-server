const { Op } = require('sequelize');

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

// Cache cleanup optimization - only run cleanup once per hour
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

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

// Check cache for a link (ML results only)
exports.getCachedResult = async (link_ID) => {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      // Only run cleanup if enough time has passed (performance optimization)
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL) {
        await exports.deleteOldCache();
        lastCleanupTime = now;
      }
      
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

// Delete cache entries older than 1 week
exports.deleteOldCache = async () => {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // First check if there are any old entries to delete
      const oldEntries = await CachedResults.findOne({
        where: {
          createdAt: { [Op.lt]: oneWeekAgo }
        }
      });
      
      // Only execute delete if old entries exist
      if (oldEntries) {
        await CachedResults.destroy({
          where: {
            createdAt: { [Op.lt]: oneWeekAgo }
          }
        });
        console.log('[CacheService] 🧹 Cleaned up old database cache entries');
      }
    } catch (error) {
      console.warn('[CacheService] Database cleanup failed:', error.message);
    }
  }
  
  // Clean up memory cache
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > MEMORY_CACHE_TTL) {
      memoryCache.delete(key);
      cleanedCount++;
    }
  }
  
  // Clean up URL cache
  let urlCleanedCount = 0;
  for (const [key, value] of urlCache.entries()) {
    if (now - value.timestamp > URL_CACHE_TTL) {
      urlCache.delete(key);
      urlCleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[CacheService] 🧹 Cleaned up ${cleanedCount} expired memory cache entries`);
  }
  if (urlCleanedCount > 0) {
    console.log(`[CacheService] 🧹 Cleaned up ${urlCleanedCount} expired URL cache entries`);
  }
};

// Check cache for a link by URL (for single endpoint)
exports.getCachedResultByUrl = async (url) => {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    try {
      // Only run cleanup if enough time has passed (performance optimization)
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL) {
        await exports.deleteOldCache();
        lastCleanupTime = now;
      }
      
      // Find the most recent ScannedLink for this URL
      const link = await ScannedLink.findOne({ 
        where: { url },
        order: [['scanTimestamp', 'DESC']] // Get the most recent one
      });
      
      if (!link) return null;
      
      // Check if we have a cached result for this link
      const cached = await CachedResults.findOne({ where: { link_ID: link.link_ID } });
      if (cached) return cached;
      
      // If not in cache table, check ScanResults directly
      const result = await ScanResults.findOne({ where: { link_ID: link.link_ID } });
      return result;
    } catch (error) {
      console.warn('[CacheService] Database URL cache failed:', error.message);
    }
  }
  
  // Memory cache doesn't support URL-based lookups (would need ScannedLink data)
  // This is acceptable since this function is mainly for database-based caching
  console.log('[CacheService] URL-based cache lookup requires database connection');
  return null;
};

// Get cache statistics
exports.getCacheStats = async () => {
  const dbAvailable = await testDatabaseConnection();
  const stats = {
    databaseAvailable: dbAvailable,
    memoryCache: {
      size: memoryCache.size,
      maxAge: '24 hours'
    },
    urlCache: {
      size: urlCache.size,
      maxAge: '10 minutes'
    }
  };
  
  if (dbAvailable) {
    try {
      const dbCacheSize = await CachedResults.count();
      stats.databaseCache = {
        size: dbCacheSize,
        maxAge: '1 week'
      };
    } catch (error) {
      stats.databaseCache = { error: error.message };
    }
  }
  
  return stats;
};

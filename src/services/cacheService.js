const { Op } = require('sequelize');
const CachedResults = require('../models/CachedResults');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

/**
 * CACHE SERVICE
 * 
 * This service manages caching for ML analysis results only.
 * 
 * Caching Strategy:
 * - ML results: CACHED (expensive computation, slow response)
 * - Tranco whitelist results: NOT CACHED (fast API, real-time rankings)
 * 
 * Cache duration: 1 week (automatic cleanup)
 */

// Check cache for a link (ML results only)
exports.getCachedResult = async (link_ID) => {
  // Remove old cache entries before checking
  await exports.deleteOldCache();
  return CachedResults.findOne({ where: { link_ID } });
};

// Store ML analysis result in cache
exports.setCachedResult = async (result) => {
  return CachedResults.create(result);
};

// Delete cache entries older than 1 week
exports.deleteOldCache = async () => {
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
  }
};

// Check cache for a link by URL (for single endpoint)
exports.getCachedResultByUrl = async (url) => {
  // Remove old cache entries before checking
  await exports.deleteOldCache();
  
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
};

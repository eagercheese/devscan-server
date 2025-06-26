const { Op } = require('sequelize');
const CachedResults = require('../models/CachedResults');

// Check cache for a link
exports.getCachedResult = async (link_ID) => {
  // Remove old cache entries before checking
  await exports.deleteOldCache();
  return CachedResults.findOne({ where: { link_ID } });
};

// Store result in cache
exports.setCachedResult = async (result) => {
  return CachedResults.create(result);
};

// Delete cache entries older than 1 week
exports.deleteOldCache = async () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await CachedResults.destroy({
    where: {
      createdAt: { [Op.lt]: oneWeekAgo }
    }
  });
};

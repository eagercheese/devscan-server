require('dotenv').config();
const cacheService = require('../src/services/cacheService');
const CachedResults = require('../src/models/CachedResults');
const ScanResults = require('../src/models/ScanResults');
const ScannedLink = require('../src/models/ScannedLink');

describe('Cache Service', () => {
  it('should delete old cache entries', async () => {
    // Insert referenced rows for foreign keys
    const scanResult = await ScanResults.create({}); // auto-increment result_ID
    const scannedLink = await ScannedLink.create({ url: 'https://example.com' }); // auto-increment link_ID
    // Insert a fake old cache entry
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await CachedResults.create({
      results_ID: scanResult.result_ID,
      link_ID: scannedLink.link_ID,
      isMalicious: false,
      anomalyScore: 0.1,
      classificationScore: 0.9,
      admin_ID: null,
      createdAt: oldDate,
      updatedAt: oldDate
    });
    // Run deleteOldCache
    await cacheService.deleteOldCache();
    const found = await CachedResults.findOne({ where: { link_ID: scannedLink.link_ID } });
    expect(found).toBeNull();
  });
});

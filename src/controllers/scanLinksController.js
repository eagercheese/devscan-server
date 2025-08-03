const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');
const whitelistService = require('../services/whitelistService');
const ScanSession = require('../models/ScanSession');
const ScannedLink = require('../models/ScannedLink');
const ScanResults = require('../models/ScanResults');

// POST /api/scan-links
exports.scanLinks = async (req, res) => {
  try {
    const { session_ID, links } = req.body;
    if (!session_ID || !Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'session_ID and links array are required' });
    }
    // Check session exists
    const session = await ScanSession.findByPk(session_ID);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // For each link: cache first, then whitelist, then ML service
    const results = [];
    for (const url of links) {
      // Save link to ScannedLink
      const link = await ScannedLink.create({ session_ID, url, scanTimestamp: new Date() });
      
      // 1. Check cache first (fastest)
      const cached = await cacheService.getCachedResult(link.link_ID);
      if (cached) {
        console.log(`Cache hit for URL: ${url}`);
        results.push(cached);
        continue;
      }
      
      // 2. Check whitelist if not cached
      const whitelistResult = await whitelistService.checkWhitelist(url);
      if (whitelistResult.isWhitelisted) {
        console.log(`URL ${url} is whitelisted (${whitelistResult.reason})`);
        const result = await ScanResults.create({
          isMalicious: false,
          anomalyScore: 0.0,
          classificationScore: 1.0, // High confidence it's safe
          intelMatch: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
          link_ID: link.link_ID,
          session_ID
        });
        
        // Note: Whitelist results are NOT cached as Tranco API calls are fast
        // and don't require expensive computation like ML analysis
        
        results.push(result);
        continue;
      }
      
      // 3. Call ML service if not whitelisted and not cached
      const mlResponse = await mlService.analyzeLinks([url]);
      const verdict = mlResponse.verdicts[0]; // Get the first verdict from the response
      const result = await ScanResults.create({
        isMalicious: verdict.isMalicious,
        anomalyScore: verdict.anomalyScore,
        classificationScore: verdict.classificationScore,
        intelMatch: verdict.intelMatch,
        link_ID: link.link_ID,
        session_ID
      });
      // Cache the ML result for future use (ML analysis is expensive and benefits from caching)
      await cacheService.setCachedResult({
        results_ID: result.result_ID,
        link_ID: link.link_ID,
        isMalicious: result.isMalicious,
        anomalyScore: result.anomalyScore,
        classificationScore: result.classificationScore,
        admin_ID: null // or set if available
      });
      results.push(result);
    }
    
    // Include ScannedLink data in the response for client processing
    const enrichedResults = await Promise.all(results.map(async (result) => {
      const scannedLink = await ScannedLink.findByPk(result.link_ID);
      return {
        ...result.toJSON(),
        ScannedLink: scannedLink ? scannedLink.toJSON() : null
      };
    }));
    
    res.json({ results: enrichedResults });
  } catch (error) {
    console.error('Error scanning links:', error);
    res.status(500).json({ error: 'Failed to scan links' });
  }
};

// POST /api/scan-link (for extension quick test)
exports.scanLink = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    console.log('Scanning link:', url);

    // 1. Check cache first (fastest) - try to find existing scan result for this URL
    const cachedResult = await cacheService.getCachedResultByUrl(url);
    if (cachedResult) {
      console.log('Cache hit for:', url);
      return res.json({
        isMalicious: cachedResult.isMalicious,
        anomalyScore: parseFloat(cachedResult.anomalyScore),
        classificationScore: parseFloat(cachedResult.classificationScore),
        intelMatch: cachedResult.intelMatch || 'none',
        cached: true
      });
    }

    // 2. Check whitelist if not cached
    const whitelistResult = await whitelistService.checkWhitelist(url);
    if (whitelistResult.isWhitelisted) {
      console.log(`URL ${url} is whitelisted (${whitelistResult.reason})`);
      
      // Save whitelist result to database for caching
      const link = await ScannedLink.create({ 
        url, 
        scanTimestamp: new Date() 
      });
      
      const result = await ScanResults.create({
        isMalicious: false,
        anomalyScore: 0.0,
        classificationScore: 1.0,
        intelMatch: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
        link_ID: link.link_ID
      });
      
      // Note: Whitelist results are NOT cached as Tranco API calls are fast
      // and don't require expensive computation like ML analysis
      
      return res.json({
        isMalicious: false,
        anomalyScore: 0.0,
        classificationScore: 1.0,
        intelMatch: `Whitelisted via ${whitelistResult.source}${whitelistResult.rank ? ` (rank: ${whitelistResult.rank})` : ''}`,
        cached: false,
        whitelisted: true
      });
    }

    // 3. If not cached and not whitelisted, try ML service, but fall back to safe default if it fails
    let verdict = {
      isMalicious: false,
      anomalyScore: 0.1,
      classificationScore: 0.9,
      intelMatch: 'none'
    };

    try {
      const mlResponse = await mlService.analyzeLinks([url]);
      if (mlResponse && mlResponse.verdicts && mlResponse.verdicts[0]) {
        verdict = mlResponse.verdicts[0];
      }
    } catch (mlError) {
      console.log('ML service unavailable, using safe default for:', url);
    }

    // Save the scan result for future use
    const link = await ScannedLink.create({ 
      session_ID: null, // No session for quick scans
      url, 
      scanTimestamp: new Date() 
    });
    
    const result = await ScanResults.create({
      isMalicious: verdict.isMalicious,
      anomalyScore: verdict.anomalyScore,
      classificationScore: verdict.classificationScore,
      intelMatch: verdict.intelMatch || 'none',
      link_ID: link.link_ID,
      session_ID: null
    });

    console.log('Scan complete for:', url, 'Result:', verdict);

    res.json({
      isMalicious: result.isMalicious,
      anomalyScore: parseFloat(result.anomalyScore),
      classificationScore: parseFloat(result.classificationScore),
      intelMatch: result.intelMatch,
      cached: false
    });
  } catch (error) {
    console.error('Error in scanLink:', error);
    res.status(500).json({ error: 'Failed to scan link', details: error.message });
  }
};

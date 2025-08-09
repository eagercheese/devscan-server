// src/controllers/linkExtractor.controller.js
const { extractLinksFromUrl } = require ('../services/extractlinksService.js');

exports.scanAndExtractLinks = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const result = await extractLinksFromUrl(url);
  return res.json(result);
}


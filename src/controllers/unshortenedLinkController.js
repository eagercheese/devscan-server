// src/controllers/unshortenedLinkController.js
const { unshortenedLinkService } = require ('../services/unshortenedLinkService.js');

exports.unshortenedLink = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const result = await unshortenedLinkService(url);
  return res.json(result);
}
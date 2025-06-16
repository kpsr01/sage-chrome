const { LLMService } = require('./llmService');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, videoData } = req.body;
    
    if (!query || !videoData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const llmService = new LLMService();
    const answer = await llmService.answerQuery(query, videoData);
    
    return res.status(200).json({ answer });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}; 
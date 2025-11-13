const axios = require('axios');

async function analyzeMR(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  console.log('Sending to LLM for analysis...');

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior code reviewer. You provide structured JSON responses for code review analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/gitlab-mr-review',
          'X-Title': 'GitLab MR Review Bot'
        }
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    return content;

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('OpenRouter authentication failed. Check your API key.');
      } else if (status === 402) {
        throw new Error('OpenRouter: Insufficient credits.');
      } else if (status === 429) {
        throw new Error('OpenRouter: Rate limit exceeded.');
      } else {
        throw new Error(`OpenRouter API error: ${status} - ${JSON.stringify(data)}`);
      }
    }
    throw error;
  }
}

module.exports = { analyzeMR };

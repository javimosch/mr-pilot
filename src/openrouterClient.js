const axios = require("axios");

async function analyzeMR(prompt) {
  // Support multiple providers: OpenRouter, OpenAI, Ollama, etc.
  let provider = process.env.LLM_PROVIDER || "Unknown";
  const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY;
  const model =
    process.env.LLM_MODEL ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-oss-120b:exacto";
  const apiUrl = process.env.LLM_API_URL;

  //Retro compatibility
  if (
    provider === "Unknown" &&
    !!process.env.OPENROUTER_API_KEY &&
    !!process.env.OPENROUTER_MODEL
  ) {
    provider = "openrouter";
  }

  // Determine API endpoint based on provider
  let endpoint;
  let requiresAuth = true;

  if (apiUrl) {
    // Custom URL takes precedence
    endpoint = apiUrl;
  } else {
    switch (provider.toLowerCase()) {
      case "openrouter":
        endpoint = "https://openrouter.ai/api/v1/chat/completions";
        break;
      case "openai":
        endpoint = "https://api.openai.com/v1/chat/completions";
        break;
      case "ollama":
        endpoint = "http://localhost:11434/v1/chat/completions";
        requiresAuth = false; // Ollama doesn't require auth by default
        break;
      case "azure":
        if (!apiUrl) {
          throw new Error("LLM_API_URL is required for Azure OpenAI provider");
        }
        endpoint = apiUrl;
        break;
      default:
        throw new Error(
          `Unknown LLM_PROVIDER: ${provider}. Supported: openrouter, openai, ollama, azure`,
        );
    }
  }

  if (requiresAuth && !apiKey) {
    throw new Error("LLM_API_KEY environment variable is not set");
  }

  console.log(`Sending to LLM for analysis (${provider})...`);

  const maxRetries = 3;
  const timeout = 120000; // 2 minutes for LLM calls

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (requiresAuth && apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      // Add provider-specific headers
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://github.com/gitlab-mr-review";
        headers["X-Title"] = "GitLab MR Review Bot";
      } else if (provider === "azure") {
        headers["api-key"] = apiKey;
        delete headers["Authorization"];
      }

      if (attempt > 1) {
        console.log(`Retrying LLM request... (attempt ${attempt}/${maxRetries})`);
      }

      const response = await axios.post(
        endpoint,
        {
          model: model,
          messages: [
            {
              role: "system",
              content:
                "You are a senior code reviewer. You provide structured JSON responses for code review analysis.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        { 
          headers,
          timeout: timeout
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from LLM");
      }

      return content;

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      // Check if it's a timeout
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        if (isLastAttempt) {
          throw new Error(`LLM request timed out after ${maxRetries} attempts. Try a smaller diff with --max-diff-chars`);
        }
        console.log(`⚠️  Request timed out, retrying in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // Don't retry auth errors or client errors
        if (status === 401) {
          throw new Error(
            `${provider} authentication failed. Check your API key.`,
          );
        } else if (status === 402) {
          throw new Error(`${provider}: Insufficient credits.`);
        } else if (status === 400) {
          throw new Error(`${provider}: Bad request - ${JSON.stringify(data)}`);
        } else if (status === 429) {
          // Rate limit - retry with exponential backoff
          if (isLastAttempt) {
            throw new Error(`${provider}: Rate limit exceeded after ${maxRetries} attempts.`);
          }
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⚠️  Rate limit hit, waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else if (status >= 500) {
          // Server error - retry
          if (isLastAttempt) {
            throw new Error(`${provider} server error after ${maxRetries} attempts: ${status} - ${JSON.stringify(data)}`);
          }
          console.log(`⚠️  Server error (${status}), retrying in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        } else {
          throw new Error(
            `${provider} API error: ${status} - ${JSON.stringify(data)}`,
          );
        }
      }
      
      // Unknown error
      if (isLastAttempt) {
        throw error;
      }
      console.log(`⚠️  Error: ${error.message}, retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

module.exports = { analyzeMR };

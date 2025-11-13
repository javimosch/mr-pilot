# LLM Provider Examples

## OpenRouter (Default)
```bash
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=anthropic/claude-3.5-sonnet

# Popular models on OpenRouter:
# - anthropic/claude-3.5-sonnet (recommended)
# - anthropic/claude-3-opus
# - openai/gpt-4o
# - google/gemini-2.0-flash-exp
# - meta-llama/llama-3.1-70b-instruct
```

## OpenAI
```bash
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o

# Available models:
# - gpt-4o (recommended)
# - gpt-4-turbo
# - gpt-3.5-turbo
```

## Ollama (Local - Free!)
```bash
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b

# No API key needed!
# Models to try:
# - llama3.1:8b (fast, good quality)
# - qwen2.5:14b (better reasoning)
# - deepseek-coder-v2:16b (code-focused)
# - mistral-nemo:12b

# Install: https://ollama.com/
# Pull model: ollama pull llama3.1:8b
# Default URL: http://localhost:11434/v1/chat/completions
```

## Azure OpenAI
```bash
LLM_PROVIDER=azure
LLM_API_KEY=your-azure-api-key
LLM_MODEL=gpt-4
LLM_API_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview
```

## Custom OpenAI-compatible endpoints
Many providers offer OpenAI-compatible APIs:
```bash
LLM_PROVIDER=openai
LLM_API_KEY=your-key
LLM_MODEL=your-model-name
LLM_API_URL=https://your-endpoint.com/v1/chat/completions

# Examples:
# - LM Studio (local): http://localhost:1234/v1/chat/completions
# - Together.ai: https://api.together.xyz/v1/chat/completions
# - Anyscale: https://api.endpoints.anyscale.com/v1/chat/completions
# - Groq: https://api.groq.com/openai/v1/chat/completions
```

## Tips

### Best models for code review:
1. **Claude 3.5 Sonnet** (OpenRouter) - Most thorough, best reasoning
2. **GPT-4o** (OpenAI) - Fast, reliable
3. **Llama 3.1 70B** (OpenRouter/Ollama) - Good quality, cheaper
4. **Qwen 2.5 14B** (Ollama) - Great for local, fast

### Cost considerations:
- **Free:** Ollama (local), some OpenRouter free tier models
- **Cheap:** Gemini Flash, Llama models on OpenRouter
- **Premium:** Claude 3.5 Sonnet, GPT-4o
- **Mid-range:** GPT-3.5-turbo, Mistral models

### For CI/CD:
- Use faster models: gpt-3.5-turbo, gemini-flash, llama3.1:8b
- Set MAX_DIFF_CHARS lower to reduce costs
- Consider Ollama for self-hosted CI

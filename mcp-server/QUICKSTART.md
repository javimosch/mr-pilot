# Quick Start Guide

Get the MCP server running in under 5 minutes!

## Docker (Recommended)

### 1. Prerequisites
- Docker and Docker Compose installed
- GitLab/GitHub tokens
- LLM API key

### 2. Setup Environment

```bash
cd mcp-server
cp docker.env.example .env
```

Edit `.env` and add your credentials:
```bash
GITLAB_TOKEN=glpat-your-token-here
GITLAB_API=https://gitlab.com/api/v4
GITHUB_TOKEN=ghp-your-token-here
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=openai/gpt-oss-120b:exacto
```

### 3. Start Server

```bash
make up
# or
docker compose up -d
```

### 4. Verify

```bash
make health
# or
curl http://localhost:8000/health
```

Expected output:
```json
{
  "status": "ok",
  "server": "mr-pilot-mcp-server",
  "version": "1.0.0",
  "protocol": "2025-06-18",
  "activeSessions": 0
}
```

### 5. Configure MCP Client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mr-pilot": {
      "url": "http://127.0.0.1:8000/mcp",
      "transport": "sse"
    }
  }
}
```

### 6. Test

Restart Claude Desktop and try:
```
Review this merge request: https://gitlab.com/your-org/your-project/-/merge_requests/123
```

## Local Development

### 1. Prerequisites
- Node.js 14+
- mr-pilot installed globally or in parent directory

### 2. Setup Environment

```bash
cd mcp-server
cp .env.example .env
```

Edit `.env` with your credentials.

### 3. Start Server

```bash
npm start
# or
make dev
```

### 4. Verify

```bash
node diagnose.js
```

## Common Commands

### Docker
```bash
make up          # Start server
make down        # Stop server
make logs        # View logs
make restart     # Restart server
make health      # Check health
make shell       # Open shell in container
make rebuild     # Rebuild from scratch
```

### Local
```bash
npm start        # Start server
node diagnose.js # Run diagnostics
node test-client.js <mr-url>  # Test with MR
```

## Troubleshooting

### Server won't start
```bash
# Check logs
make logs

# Check if port is in use
lsof -i :8000

# Rebuild
make rebuild
```

### Can't connect from MCP client
1. Verify server is running: `make health`
2. Check client configuration (URL must be `http://127.0.0.1:8000/mcp`)
3. Restart client
4. Check server logs: `make logs`

### Environment variables not working
```bash
# Verify .env file
cat .env

# Check variables in container
docker compose exec mcp-server env | grep -E 'GITLAB|GITHUB|LLM'

# Restart after changes
make restart
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Read [DOCKER.md](DOCKER.md) for Docker deployment details
- Read [USAGE.md](USAGE.md) for usage examples
- Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting

## Support

If you encounter issues:
1. Check the logs: `make logs`
2. Run diagnostics: `node diagnose.js`
3. Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. File an issue with logs and configuration


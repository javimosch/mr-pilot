# MCP Server for mr-pilot - Complete Summary

## Overview

A production-ready Model Context Protocol (MCP) server that exposes mr-pilot's AI code review capabilities as MCP tools. Supports both local Node.js deployment and Docker containerization.

## What's Included

### Core Files
- **server.js** - Main MCP server implementation (Streamable HTTP transport)
- **package.json** - Package configuration
- **Dockerfile** - Multi-stage Docker build
- **compose.yml** - Docker Compose configuration
- **Makefile** - Convenient Docker commands

### Configuration Files
- **.env.example** - Environment template for local development
- **docker.env.example** - Environment template for Docker
- **.dockerignore** - Docker build exclusions
- **.gitignore** - Git exclusions

### Documentation
- **README.md** - Main documentation
- **QUICKSTART.md** - 5-minute quick start guide
- **DOCKER.md** - Comprehensive Docker deployment guide
- **USAGE.md** - Usage examples and patterns
- **IMPLEMENTATION.md** - Technical implementation details
- **TROUBLESHOOTING.md** - Detailed troubleshooting guide
- **CHANGELOG.md** - Version history
- **SUMMARY.md** - This file

### Testing & Diagnostics
- **test-client.js** - Simple test client for validation
- **diagnose.js** - Comprehensive diagnostic tool

## Key Features

### MCP Protocol
- ✅ Full MCP specification compliance (2025-06-18)
- ✅ Streamable HTTP transport
- ✅ JSON-RPC 2.0 messaging
- ✅ Session management
- ✅ Health check endpoint

### Tools
- **review_merge_request** - AI-powered code review for GitLab MRs and GitHub PRs
  - Supports ticket specifications
  - Supports project guidelines
  - Optional comment posting
  - Configurable diff size limits
  - Structured output (goal status, score, issues, remarks)

### Deployment Options
- **Local Node.js** - Development mode with npm run dev
- **Docker** - Production-ready containerization
- **Docker Compose** - Easy orchestration with environment management

### Production Features
- 🐳 Multi-stage Docker build
- 🔍 Health checks
- 📊 Resource limits
- 📝 Log rotation
- 🔄 Auto-restart
- 🛡️ Security best practices

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                            │
│                    (Claude Desktop, etc.)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/SSE
                          │ JSON-RPC 2.0
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
│                    (server.js)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /mcp  - JSON-RPC requests                      │   │
│  │  GET /mcp   - SSE stream                             │   │
│  │  GET /health - Health check                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tool: review_merge_request                          │   │
│  │  - Validates parameters                              │   │
│  │  - Builds CLI arguments                              │   │
│  │  - Executes mr-pilot                                 │   │
│  │  - Parses output                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ spawn()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      mr-pilot CLI                            │
│  - Fetches MR/PR from GitLab/GitHub                         │
│  - Analyzes code changes                                    │
│  - Calls LLM for review                                     │
│  - Returns structured results                               │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Docker (Recommended)
```bash
cd mcp-server
cp docker.env.example .env
# Edit .env with your credentials
make up
make health
```

### Local Development
```bash
cd mcp-server
cp .env.example .env
# Edit .env with your credentials
npm start
node diagnose.js
```

## Environment Variables

### Required
- `GITLAB_TOKEN` or `GITHUB_TOKEN` - Platform access
- `LLM_PROVIDER` - openrouter, openai, ollama, azure
- `LLM_API_KEY` - API key for LLM provider
- `LLM_MODEL` - Model to use

### Optional
- `GITLAB_API` - GitLab API URL (default: https://gitlab.com/api/v4)
- `GITLAB_DEFAULT_PROJECT` - Default project path
- `GITHUB_DEFAULT_REPO` - Default repository
- `LLM_API_URL` - Custom API URL
- `MAX_DIFF_CHARS` - Max diff size (default: 50000)
- `MCP_SERVER_PORT` - Server port (default: 8000)
- `MCP_SERVER_HOST` - Server host (default: 127.0.0.1 or 0.0.0.0 in Docker)
- `NODE_ENV` - development or production

## MCP Client Configuration

### Claude Desktop
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

## Common Commands

### Docker
```bash
make up          # Start server
make down        # Stop server
make logs        # View logs
make restart     # Restart server
make health      # Check health
make shell       # Open shell
make rebuild     # Rebuild from scratch
```

### Local
```bash
npm start                    # Start server
node diagnose.js             # Run diagnostics
node test-client.js <url>    # Test with MR/PR
```

## File Structure

```
mcp-server/
├── server.js                 # Main server
├── package.json              # Package config
├── Dockerfile                # Docker build
├── compose.yml               # Docker Compose
├── Makefile                  # Convenience commands
├── .env.example              # Local env template
├── docker.env.example        # Docker env template
├── .dockerignore             # Docker exclusions
├── .gitignore                # Git exclusions
├── README.md                 # Main docs
├── QUICKSTART.md             # Quick start
├── DOCKER.md                 # Docker guide
├── USAGE.md                  # Usage examples
├── IMPLEMENTATION.md         # Technical details
├── TROUBLESHOOTING.md        # Troubleshooting
├── CHANGELOG.md              # Version history
├── SUMMARY.md                # This file
├── test-client.js            # Test client
└── diagnose.js               # Diagnostic tool
```

## Testing

### Health Check
```bash
curl http://localhost:8000/health
```

### Diagnostic Tool
```bash
node diagnose.js
```

### Test Client
```bash
node test-client.js https://gitlab.com/org/project/-/merge_requests/123
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

Common issues:
- Connection timeout → Fixed in v1.0.1 with proper HTTP status codes
- Protocol version errors → Made optional in v1.0.1
- Environment variables not working → Check .env file and restart

## Version History

- **v1.0.1** (2025-01-14) - Docker support, Streamable HTTP fixes
- **v1.0.0** (2025-01-14) - Initial release

## License

MIT - Same as mr-pilot

## Support

1. Check documentation in this directory
2. Run diagnostic tool: `node diagnose.js`
3. Check logs: `make logs` or `docker compose logs`
4. Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
5. File an issue with logs and configuration


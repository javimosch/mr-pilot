# MCP Server for mr-pilot

Model Context Protocol (MCP) server that exposes mr-pilot's AI code review capabilities as MCP tools. This allows MCP clients like Claude Desktop to review GitLab Merge Requests and GitHub Pull Requests.

## Features

- **SSE/HTTP Transport**: Implements the MCP specification with Server-Sent Events for real-time communication
- **Code Review Tool**: Exposes `review_merge_request` tool for reviewing MRs/PRs
- **Proxy Mode**: Distributed execution with proxy server and slave instances (see [PROXY-MODE.md](PROXY-MODE.md))
- **Environment Variable Support**: All mr-pilot configuration via environment variables
- **Comprehensive Logging**: Detailed logs with timestamps for debugging
- **Development & Production Modes**: Supports both `npm run dev` and installed binary

## Installation

### Option 1: Docker (Recommended for Production)

**Prerequisites:**
- Docker and Docker Compose installed

**Quick Start:**
```bash
cd mcp-server
cp docker.env.example .env
# Edit .env with your credentials
docker compose up -d
```

See [DOCKER.md](DOCKER.md) for detailed Docker deployment guide.

### Option 2: Node.js (Development)

**Prerequisites:**
- Node.js 14.0.0 or higher
- mr-pilot installed (either globally or in parent directory)
- Required environment variables configured

**Setup:**

1. Navigate to the mcp-server directory:
```bash
cd mcp-server
```

2. Set up environment variables (see Configuration section below)

3. Start the server:
```bash
# Development mode (uses npm run dev from parent directory)
npm start

# Production mode (uses installed mr-pilot binary)
NODE_ENV=production npm start
```

## Configuration

### Environment Variables

The MCP server requires the same environment variables as mr-pilot:

#### GitLab Configuration
- `GITLAB_TOKEN` - GitLab personal access token (required for GitLab MRs)
- `GITLAB_API` - GitLab API URL (e.g., `https://gitlab.com/api/v4`)
- `GITLAB_DEFAULT_PROJECT` - Default GitLab project path (optional, e.g., `group/subgroup/project`)

#### GitHub Configuration
- `GITHUB_TOKEN` - GitHub personal access token (required for GitHub PRs)
- `GITHUB_DEFAULT_REPO` - Default GitHub repository (optional, e.g., `owner/repo`)

#### LLM Configuration
- `LLM_PROVIDER` - LLM provider: `openrouter`, `openai`, `ollama`, or `azure`
- `LLM_API_KEY` - API key for the LLM provider
- `LLM_MODEL` - Model to use (e.g., `openai/gpt-oss-120b:exacto`, `gpt-4o`, `llama3.1:8b`)
- `LLM_API_URL` - Custom API URL (optional, for Azure or custom endpoints)

#### General Configuration
- `MAX_DIFF_CHARS` - Maximum characters for diffs (optional, default: 50000)
- `MCP_SERVER_PORT` - Server port (optional, default: 8000)
- `MCP_SERVER_HOST` - Server host (optional, default: 127.0.0.1)
- `NODE_ENV` - Environment mode: `development` or `production` (default: development)

### Example .env File

Create a `.env` file in the mcp-server directory or export these variables:

```bash
# GitLab
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_API=https://gitlab.com/api/v4
GITLAB_DEFAULT_PROJECT=myorg/myproject

# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_DEFAULT_REPO=owner/repo

# LLM
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
LLM_MODEL=openai/gpt-oss-120b:exacto

# Server
MCP_SERVER_PORT=8000
MCP_SERVER_HOST=127.0.0.1
NODE_ENV=development
```

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Other MCP Clients

Configure your MCP client to connect to:
- **URL**: `http://127.0.0.1:8000/mcp`
- **Transport**: SSE (Server-Sent Events)
- **Protocol Version**: `2025-06-18`

## Available Tools

### review_merge_request

Reviews a GitLab Merge Request or GitHub Pull Request using AI.

**Parameters:**
- `mrUrlOrId` (required): MR/PR URL or numeric ID
- `ticketSpec` (optional): Ticket/requirement specification text
- `guidelines` (optional): Project guidelines to reduce false positives
- `postComment` (optional): Post review as comment (default: false)
- `maxDiffChars` (optional): Maximum diff characters
- `acceptanceCriteria` (optional): Acceptance criteria text
- `platform` (optional): Force platform: "gitlab" or "github"
- `project` (optional): Project path (required for numeric IDs)
- `debug` (optional): Enable debug mode (default: false)

**Returns:**
- `success`: Whether review completed successfully
- `goalStatus`: "met", "partially_met", or "unmet"
- `score`: Quality score (0-100)
- `issues`: Array of potential issues found
- `remarks`: Additional observations
- `commentPosted`: Whether comment was posted

**Example Usage in Claude:**

```
Review this merge request: https://gitlab.com/myorg/myproject/-/merge_requests/123
```

```
Review PR #456 in owner/repo with these requirements:
- Must include unit tests
- Must update documentation
- No console.log statements
```

## API Endpoints

- `POST /mcp` - Send JSON-RPC requests
- `GET /mcp` - Open SSE stream for server pushes
- `DELETE /mcp` - Terminate session

## Logging

The server provides comprehensive logging with timestamps:
- `[INFO]` - Successful operations and key steps
- `[WARN]` - Warnings and non-critical issues
- `[ERROR]` - Error conditions with details

All logs include ISO timestamps for debugging.

## Troubleshooting

### Diagnostic Tool

Run the diagnostic tool to check server health:
```bash
node diagnose.js
```

This will test:
- Server health endpoint
- SSE connection
- POST requests (initialize)
- Tools listing

### Server won't start
- Check that port 8000 is available: `lsof -i :8000`
- Verify all required environment variables are set
- Check Node.js version (>= 14.0.0): `node --version`

### Tool execution fails
- Verify mr-pilot is installed and accessible
- Check environment variables are correctly configured
- Enable debug mode: `debug: true` in tool parameters
- Check server logs for detailed error messages

### MCP client can't connect

**Symptoms**: Client keeps reconnecting, SSE connections open and close immediately

**Common causes**:
1. **Wrong URL format**: Make sure you're using `http://127.0.0.1:8000/mcp` not just `http://127.0.0.1:8000`
2. **Missing protocol version**: Some clients need explicit configuration
3. **Transport type mismatch**: Ensure client is configured for SSE transport

**For Claude Desktop**:
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

**Check server logs**: Look for POST requests. If you only see GET requests, the client isn't sending JSON-RPC calls.

**Test manually**:
```bash
# Test health
curl http://127.0.0.1:8000/health

# Test SSE connection
curl -N http://127.0.0.1:8000/mcp

# Test POST request
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Protocol-Version: 2025-06-18" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## Development

### Running in Development Mode

```bash
cd mcp-server
NODE_ENV=development npm start
```

This uses `npm run dev` from the parent directory to invoke mr-pilot.

### Running in Production Mode

```bash
cd mcp-server
NODE_ENV=production npm start
```

This uses the globally installed `mr-pilot` binary.

### Testing Proxy Mode

```bash
npm run test:proxy
```

This runs integration tests for the proxy mode feature.

## Advanced Features

### Proxy Mode

For distributed execution and credential isolation, see [PROXY-MODE.md](PROXY-MODE.md) for detailed documentation on setting up proxy and slave instances.

## License

MIT - Same as mr-pilot


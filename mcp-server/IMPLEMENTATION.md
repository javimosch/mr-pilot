# MCP Server Implementation Summary

This document describes the implementation of the Model Context Protocol (MCP) server for mr-pilot.

## Architecture Overview

The MCP server is a pure Node.js implementation (no external dependencies) that:

1. **Implements SSE/HTTP Transport**: Full MCP specification compliance with Server-Sent Events
2. **Integrates with mr-pilot CLI**: Executes the mr-pilot tool behind the scenes
3. **Exposes Review Tool**: Provides `review_merge_request` tool via MCP protocol
4. **Handles Environment Variables**: Passes all configuration to mr-pilot via environment
5. **Provides Comprehensive Logging**: Timestamps and context for all operations

## File Structure

```
mcp-server/
├── server.js              # Main MCP server implementation
├── package.json           # Package configuration
├── .env.example          # Example environment variables
├── .gitignore            # Git ignore rules
├── README.md             # Main documentation
├── USAGE.md              # Usage guide with examples
├── IMPLEMENTATION.md     # This file
└── test-client.js        # Simple test client
```

## Key Components

### 1. HTTP Server (`server.js`)

- **Port**: 8000 (configurable via `MCP_SERVER_PORT`)
- **Host**: 127.0.0.1 (configurable via `MCP_SERVER_HOST`)
- **Protocol**: MCP 2025-06-18
- **Transport**: SSE/HTTP

### 2. Request Handlers

#### POST Handler (`handlePost`)
- Receives JSON-RPC 2.0 requests from clients
- Validates protocol version
- Manages sessions
- Dispatches to method handlers
- Returns JSON-RPC responses

#### GET Handler (`handleSSE`)
- Establishes Server-Sent Events stream
- Sends heartbeats every 15 seconds
- Supports event resumption via `Last-Event-ID`
- Handles graceful disconnection

#### DELETE Handler (`handleDelete`)
- Terminates sessions
- Cleans up session storage

### 3. Method Dispatcher (`dispatchMethod`)

Handles MCP protocol methods:

- **`initialize`**: Protocol handshake, returns server capabilities
- **`tools/list`**: Returns available tools (review_merge_request)
- **`tools/call`**: Executes the review tool

### 4. Tool Implementation (`reviewMergeRequest`)

The main tool that:

1. Validates input parameters
2. Builds CLI arguments for mr-pilot
3. Writes temporary files for ticket specs and guidelines
4. Executes mr-pilot CLI (via npm run dev or binary)
5. Parses output to extract review results
6. Returns structured response

### 5. CLI Execution (`executeMrPilot`)

Handles two execution modes:

**Development Mode** (`NODE_ENV=development`):
```bash
npm run dev -- <args>
```

**Production Mode** (`NODE_ENV=production`):
```bash
mr-pilot <args>
```

### 6. Output Parser (`parseMrPilotOutput`)

Extracts structured data from mr-pilot's console output:
- Goal status (met/partially_met/unmet)
- Quality score (0-100)
- List of issues
- Remarks and observations

## MCP Protocol Compliance

### JSON-RPC 2.0

All messages follow JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { ... },
  "id": 1
}
```

### Headers

Required headers:
- `Mcp-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id: <uuid>` (after initialization)
- `Content-Type: application/json` (for POST)

### Session Management

- Sessions created on first request
- Session ID returned in `Mcp-Session-Id` header
- Sessions stored in memory (Map)
- Automatic cleanup on DELETE

### Error Handling

Two types of errors:

1. **Protocol Errors**: JSON-RPC error responses
   - Code -32600: Invalid request
   - Code -32601: Method not found
   - Code -32700: Parse error

2. **Tool Errors**: Returned in result with `isError: true`
   - API failures
   - Invalid parameters
   - Execution errors

## Tool Schema

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "mrUrlOrId": { "type": "string", "required": true },
    "ticketSpec": { "type": "string" },
    "guidelines": { "type": "string" },
    "postComment": { "type": "boolean", "default": false },
    "maxDiffChars": { "type": "number" },
    "acceptanceCriteria": { "type": "string" },
    "platform": { "type": "string", "enum": ["gitlab", "github"] },
    "project": { "type": "string" },
    "debug": { "type": "boolean", "default": false }
  }
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "goalStatus": { "type": "string" },
    "score": { "type": "number" },
    "issues": { "type": "array", "items": { "type": "string" } },
    "remarks": { "type": "string" },
    "commentPosted": { "type": "boolean" }
  }
}
```

## Logging System

All logs include:
- ISO 8601 timestamp
- Log level (INFO/WARN/ERROR)
- Contextual message

Example:
```
[2025-01-14T10:30:45.123Z] [INFO] Tool invoked: review_merge_request with MR/PR: 123
[2025-01-14T10:30:45.456Z] [INFO] Executing mr-pilot with args: ["123"]
[2025-01-14T10:30:50.789Z] [INFO] Review completed successfully
```

## Environment Variables

The server requires the same environment variables as mr-pilot:

### Required for GitLab
- `GITLAB_TOKEN`
- `GITLAB_API`

### Required for GitHub
- `GITHUB_TOKEN`

### Required for LLM
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`

### Optional
- `GITLAB_DEFAULT_PROJECT`
- `GITHUB_DEFAULT_REPO`
- `LLM_API_URL`
- `MAX_DIFF_CHARS`
- `MCP_SERVER_PORT`
- `MCP_SERVER_HOST`
- `NODE_ENV`

## Security Features

1. **Protocol Version Validation**: Rejects invalid versions
2. **Session Management**: UUID-based sessions
3. **Input Validation**: All tool parameters validated
4. **CORS Support**: Configurable origin validation
5. **Graceful Shutdown**: SIGTERM/SIGINT handlers

## Testing

### Test Client (`test-client.js`)

Simple Node.js client that:
1. Initializes connection
2. Lists available tools
3. Calls review tool (if MR URL provided)
4. Displays results

Usage:
```bash
node test-client.js
node test-client.js https://gitlab.com/org/project/-/merge_requests/123
```

## Future Enhancements

Potential improvements:

1. **Persistent Sessions**: Store sessions in Redis/database
2. **Rate Limiting**: Prevent abuse
3. **Authentication**: API key or OAuth support
4. **HTTPS Support**: TLS/SSL for production
5. **Metrics**: Prometheus/StatsD integration
6. **Caching**: Cache review results
7. **Webhooks**: Automatic reviews on MR/PR creation
8. **Multiple Tools**: Add more mr-pilot features as tools

## Compatibility

- **Node.js**: >= 14.0.0
- **MCP Protocol**: 2025-06-18
- **mr-pilot**: >= 1.1.2
- **MCP Clients**: Claude Desktop, any MCP-compatible client

## License

MIT - Same as mr-pilot


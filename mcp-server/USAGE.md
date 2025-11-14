# MCP Server Usage Guide

This guide shows how to use the mr-pilot MCP server with various MCP clients.

## Quick Start

1. **Set up environment variables**:
```bash
cd mcp-server
cp .env.example .env
# Edit .env with your actual tokens and configuration
```

2. **Start the server**:
```bash
npm start
```

3. **Test the server**:
```bash
# Test basic connectivity
node test-client.js

# Test with an actual MR/PR
node test-client.js https://gitlab.com/myorg/myproject/-/merge_requests/123
```

## Using with Claude Desktop

### Configuration

1. Locate your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the MCP server configuration:
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

3. Restart Claude Desktop

### Example Conversations

**Basic Review:**
```
Review this merge request: https://gitlab.com/myorg/myproject/-/merge_requests/123
```

**Review with Requirements:**
```
Review PR #456 in owner/repo. Check if it meets these requirements:
- All functions must have JSDoc comments
- Unit tests required for new features
- No console.log statements in production code
```

**Review with Guidelines:**
```
Review https://github.com/owner/repo/pull/789 using these project guidelines:
- We use async/await, not callbacks
- All API calls must have error handling
- Database queries must use parameterized statements
```

**Review and Post Comment:**
```
Review MR 123 in myorg/myproject and post the review as a comment
```

## Using with Other MCP Clients

### Generic MCP Client Configuration

```javascript
{
  "url": "http://127.0.0.1:8000/mcp",
  "transport": "sse",
  "protocolVersion": "2025-06-18"
}
```

### Manual API Calls

#### 1. Initialize Connection

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### 2. List Available Tools

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: <session-id-from-initialize>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

#### 3. Call Review Tool

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "review_merge_request",
      "arguments": {
        "mrUrlOrId": "https://gitlab.com/myorg/myproject/-/merge_requests/123",
        "ticketSpec": "Feature must include unit tests",
        "postComment": false
      }
    }
  }'
```

## Advanced Usage

### Review with Ticket Specification

```javascript
{
  "name": "review_merge_request",
  "arguments": {
    "mrUrlOrId": "123",
    "project": "myorg/myproject",
    "ticketSpec": `
      User Story: As a user, I want to export data to CSV
      
      Acceptance Criteria:
      - Export button in the UI
      - CSV format with proper headers
      - Handle large datasets (>10k rows)
      - Show progress indicator
      - Error handling for failed exports
    `
  }
}
```

### Review with Project Guidelines

```javascript
{
  "name": "review_merge_request",
  "arguments": {
    "mrUrlOrId": "https://github.com/owner/repo/pull/456",
    "guidelines": `
      Code Style:
      - Use TypeScript strict mode
      - Prefer functional components
      - Use React hooks, not class components
      
      Testing:
      - 80% code coverage minimum
      - Unit tests for all business logic
      - Integration tests for API endpoints
      
      Security:
      - No hardcoded credentials
      - Sanitize all user inputs
      - Use parameterized queries
    `
  }
}
```

### Review Large MRs

```javascript
{
  "name": "review_merge_request",
  "arguments": {
    "mrUrlOrId": "789",
    "project": "myorg/myproject",
    "maxDiffChars": 100000,  // Increase limit for large diffs
    "debug": true            // Enable detailed logging
  }
}
```

### Review and Auto-Post Comment

```javascript
{
  "name": "review_merge_request",
  "arguments": {
    "mrUrlOrId": "https://gitlab.com/myorg/myproject/-/merge_requests/123",
    "postComment": true,
    "acceptanceCriteria": "Approve if score > 70 and no critical issues"
  }
}
```

## Environment-Specific Configuration

### Development Environment

```bash
# Use npm run dev from parent directory
NODE_ENV=development npm start
```

### Production Environment

```bash
# Use globally installed mr-pilot binary
NODE_ENV=production npm start
```

### Custom Port/Host

```bash
MCP_SERVER_PORT=9000 MCP_SERVER_HOST=0.0.0.0 npm start
```

## Troubleshooting

### Server Logs

The server provides detailed logs with timestamps:

```
[2025-01-14T10:30:45.123Z] [INFO] MCP Server for mr-pilot started successfully
[2025-01-14T10:30:45.124Z] [INFO] Listening on http://127.0.0.1:8000
[2025-01-14T10:31:12.456Z] [INFO] POST /mcp
[2025-01-14T10:31:12.457Z] [INFO] Dispatching method: tools/call
[2025-01-14T10:31:12.458Z] [INFO] Tool invoked: review_merge_request with MR/PR: 123
[2025-01-14T10:31:12.459Z] [INFO] Executing mr-pilot with args: ["123"]
```

### Common Issues

**"Missing Session ID" error:**
- Make sure to include the `Mcp-Session-Id` header from the initialize response

**"Invalid Protocol Version" error:**
- Ensure `Mcp-Protocol-Version: 2025-06-18` header is set

**Tool execution fails:**
- Check that all required environment variables are set
- Verify GitLab/GitHub tokens have proper permissions
- Enable debug mode: `"debug": true` in tool arguments

**Connection refused:**
- Verify server is running: `ps aux | grep node`
- Check port is not in use: `lsof -i :8000`
- Check firewall settings

## Security Considerations

- **Never expose the MCP server to the public internet** - it's designed for local use
- **Protect your environment variables** - they contain sensitive tokens
- **Use HTTPS in production** - modify server.js to use `https.createServer()`
- **Validate all inputs** - the server validates tool parameters
- **Rate limiting** - consider adding rate limiting for production use

## Performance Tips

- **Increase maxDiffChars** for large MRs/PRs to avoid truncation
- **Use project defaults** in environment variables to avoid passing project path every time
- **Enable debug mode** only when troubleshooting to reduce log volume
- **Monitor server logs** for performance issues and errors


# MCP Server Troubleshooting Guide

## Connection Issues

### Symptom: Client keeps reconnecting (SSE connections open and close)

**What you see in logs:**
```
[2025-11-14T14:52:17.783Z] [INFO] GET /mcp
[2025-11-14T14:52:17.784Z] [INFO] SSE connection without session ID, creating new session: 266b8fec-65d9-46dd-b234-469f56d53a8e
[2025-11-14T14:52:19.022Z] [INFO] GET /mcp
[2025-11-14T14:52:19.022Z] [INFO] SSE connection without session ID, creating new session: 50f6a381-40f6-435c-b21a-c4c466942d93
```

**What this means:**
- The client is successfully opening SSE connections
- But it's not sending any POST requests (JSON-RPC calls)
- The client is disconnecting and reconnecting repeatedly

**Root causes:**

#### 1. Incorrect Client Configuration

**Claude Desktop** expects a specific configuration format. Check your config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

**Correct configuration:**
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

**Common mistakes:**
- ❌ `"url": "http://127.0.0.1:8000"` (missing `/mcp`)
- ❌ `"transport": "http"` (should be `"sse"`)
- ❌ Using `localhost` instead of `127.0.0.1` (some clients have issues with localhost)

#### 2. Client Not Sending POST Requests

The MCP protocol requires:
1. Client opens SSE connection (GET /mcp)
2. Client sends initialize request (POST /mcp)
3. Client sends tools/list request (POST /mcp)
4. Client sends tools/call requests (POST /mcp)

If you only see GET requests in the logs, the client isn't following the protocol correctly.

**Check:**
- Is the client MCP-compatible?
- Is the client configured correctly?
- Are there any client-side errors?

#### 3. Protocol Version Mismatch

Some clients may expect a different protocol version or handshake.

**Our server supports**: `2025-06-18`

**Check client logs** for protocol version errors.

## Diagnostic Steps

### Step 1: Verify Server is Running

```bash
# Check if server is running
ps aux | grep "node.*server.js"

# Check if port is listening
lsof -i :8000

# Test health endpoint
curl http://127.0.0.1:8000/health
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

### Step 2: Run Diagnostic Tool

```bash
cd mcp-server
node diagnose.js
```

This will test all endpoints and show you exactly what's working and what's not.

### Step 3: Test SSE Connection Manually

```bash
# Open SSE connection (will stream events)
curl -N http://127.0.0.1:8000/mcp
```

Expected output:
```
: MCP SSE endpoint connected

: Session ID: <uuid>

: Send POST requests to /mcp for JSON-RPC calls

: heartbeat
```

### Step 4: Test POST Request Manually

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
        "name": "test",
        "version": "1.0.0"
      }
    }
  }'
```

Expected output:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {
        "listChanged": false
      }
    },
    "serverInfo": {
      "name": "mr-pilot-mcp-server",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

### Step 5: Check Client Logs

**Claude Desktop logs:**
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`
- **Linux**: `~/.config/Claude/logs/`

Look for:
- Connection errors
- Protocol errors
- Timeout errors

## Common Solutions

### Solution 1: Restart Everything

```bash
# Stop the MCP server
pkill -f "node.*server.js"

# Restart the MCP server
cd mcp-server
npm start

# Restart Claude Desktop (or your MCP client)
```

### Solution 2: Check Firewall

```bash
# macOS - allow incoming connections
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node

# Linux - check iptables
sudo iptables -L -n | grep 8000
```

### Solution 3: Try Different Port

```bash
# Use a different port
MCP_SERVER_PORT=9000 npm start
```

Then update your client configuration:
```json
{
  "mcpServers": {
    "mr-pilot": {
      "url": "http://127.0.0.1:9000/mcp",
      "transport": "sse"
    }
  }
}
```

### Solution 4: Enable Debug Logging

Add more verbose logging to the server:

```bash
# Set environment variable
DEBUG=* npm start
```

## Still Not Working?

If none of the above solutions work:

1. **Run the test client**:
   ```bash
   node test-client.js
   ```
   If this works, the server is fine and the issue is with your MCP client.

2. **Check MCP client compatibility**:
   - Is your client up to date?
   - Does it support MCP protocol version 2025-06-18?
   - Does it support SSE transport?

3. **Try a different MCP client**:
   - Test with the included test-client.js
   - Try a different MCP-compatible application

4. **Check the MCP specification**:
   - https://modelcontextprotocol.io/specification/2025-06-18/

5. **File an issue**:
   - Include server logs
   - Include client logs
   - Include your configuration
   - Include diagnostic tool output


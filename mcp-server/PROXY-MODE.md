# Proxy Mode

The MCP server supports a proxy mode that enables distributed execution of MCP tool calls. This feature allows you to set up a central proxy server that forwards requests to one or more slave instances for execution.

## Architecture

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐
│  MCP    │  HTTP   │   Proxy     │  WebSocket│   Slave      │
│ Client  │────────▶│   Server    │◀──────────│   Instance   │
└─────────┘         └─────────────┘         └──────────────┘
                     Port 8000              Port 9000
                     WS Port 8001
```

### How It Works

1. **Proxy Server**: Runs with `PROXY_MODE=1`, accepts MCP tool calls via HTTP, and forwards them to connected slave instances via WebSocket
2. **Slave Instance**: Runs with `PROXY_SLAVE=1`, connects to the proxy server, and executes tool calls locally
3. **Authentication**: Slaves authenticate using a `SLAVE_CODE` that must be in the proxy's `SLAVE_CODES` whitelist

## Configuration

### Proxy Server Setup

Set these environment variables to enable proxy mode:

```bash
# Enable proxy mode
PROXY_MODE=1

# Comma-separated list of valid slave authentication codes
SLAVE_CODES=code1,code2,code3

# WebSocket port for slave connections (optional, default: 8001)
PROXY_WS_PORT=8001

# HTTP port for MCP clients (standard config)
MCP_SERVER_PORT=8000
```

### Slave Instance Setup

Set these environment variables to enable slave mode:

```bash
# Enable slave mode
PROXY_SLAVE=1

# Authentication code (must be in proxy's SLAVE_CODES)
SLAVE_CODE=code1

# WebSocket URL of the proxy server
PROXY_SERVER_URL=ws://localhost:8001

# HTTP port for this slave (standard config)
MCP_SERVER_PORT=9000

# All mr-pilot environment variables (GitLab/GitHub tokens, LLM config, etc.)
GITLAB_TOKEN=your_token_here
GITHUB_TOKEN=your_token_here
LLM_PROVIDER=openrouter
LLM_API_KEY=your_api_key_here
LLM_MODEL=your_model_here
# ... etc
```

## Running Proxy Mode

### Starting the Proxy Server

```bash
# Set environment variables
export PROXY_MODE=1
export SLAVE_CODES=mysecret123
export MCP_SERVER_PORT=8000
export PROXY_WS_PORT=8001

# Start the server
npm start
```

### Starting the Slave Instance

```bash
# Set environment variables
export PROXY_SLAVE=1
export SLAVE_CODE=mysecret123
export PROXY_SERVER_URL=ws://localhost:8001
export MCP_SERVER_PORT=9000

# Set mr-pilot configuration
export GITLAB_TOKEN=your_token
export LLM_PROVIDER=openrouter
export LLM_API_KEY=your_key
export LLM_MODEL=your_model

# Start the slave
npm start
```

### Using Docker Compose

Create a `docker-compose.yml` for proxy setup:

```yaml
version: '3.8'

services:
  proxy:
    image: mr-pilot-mcp-server
    ports:
      - "8000:8000"
      - "8001:8001"
    environment:
      - PROXY_MODE=1
      - SLAVE_CODES=secret123,secret456
      - MCP_SERVER_PORT=8000
      - PROXY_WS_PORT=8001

  slave1:
    image: mr-pilot-mcp-server
    environment:
      - PROXY_SLAVE=1
      - SLAVE_CODE=secret123
      - PROXY_SERVER_URL=ws://proxy:8001
      - MCP_SERVER_PORT=9000
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - GITLAB_API=${GITLAB_API}
      - LLM_PROVIDER=${LLM_PROVIDER}
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_MODEL=${LLM_MODEL}
    depends_on:
      - proxy

  slave2:
    image: mr-pilot-mcp-server
    environment:
      - PROXY_SLAVE=1
      - SLAVE_CODE=secret456
      - PROXY_SERVER_URL=ws://proxy:8001
      - MCP_SERVER_PORT=9000
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - LLM_PROVIDER=${LLM_PROVIDER}
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_MODEL=${LLM_MODEL}
    depends_on:
      - proxy
```

## Use Cases

### 1. Isolating Credentials

Keep sensitive credentials (GitLab/GitHub tokens, API keys) on slave instances while exposing only the proxy to clients:

```
Client ──▶ Proxy (no credentials) ──▶ Slave (has credentials)
```

### 2. Load Distribution

Although currently only one slave is active at a time, the architecture supports future load balancing:

```
                    ┌──▶ Slave 1 (GitLab)
Client ──▶ Proxy ───┤
                    └──▶ Slave 2 (GitHub)
```

### 3. Network Segmentation

Run the proxy in a DMZ while keeping slaves with access to private resources in a secure network:

```
Public Network          DMZ              Private Network
    Client ────▶ Proxy ────▶ Slave (with VPN/private access)
```

## Testing

Run the integration test to verify proxy mode is working:

```bash
npm run test:proxy
```

The test will:
1. Start a proxy server on port 8000 (HTTP) and 8001 (WebSocket)
2. Start a slave server on port 9000 with connection to the proxy
3. Send test requests to both servers
4. Verify that requests to the proxy are forwarded to the slave
5. Clean up and report results

## Logging

Both proxy and slave modes provide detailed logging:

### Proxy Logs
- `[PROXY]` prefix for all proxy-related messages
- Connection attempts and authentication status
- Request forwarding and response handling
- Slave disconnections

### Slave Logs
- `[SLAVE]` prefix for all slave-related messages
- Connection status and authentication
- Incoming requests from proxy
- Local tool execution
- Response sending

## Limitations

1. **Single Active Slave**: Currently, only one slave can be connected at a time. If a new slave connects, the previous one is disconnected.
2. **No Load Balancing**: All requests go to the single connected slave. Load balancing across multiple slaves is planned for future versions.
3. **Request Timeout**: Proxy requests timeout after 5 minutes.
4. **Auto-Reconnect**: Slaves automatically reconnect every 5 seconds if disconnected.

## Troubleshooting

### Slave Cannot Connect

Check:
- Proxy server is running and listening on the WebSocket port
- `PROXY_SERVER_URL` is correct
- `SLAVE_CODE` matches one of the codes in `SLAVE_CODES`
- Network connectivity between slave and proxy
- Firewall rules allow WebSocket connections

### Authentication Fails

Check:
- `SLAVE_CODE` on the slave matches one of the codes in `SLAVE_CODES` on the proxy
- No extra whitespace in the codes
- Case sensitivity (codes are case-sensitive)

### Requests Not Being Forwarded

Check:
- Slave is connected and authenticated (look for "Authentication successful" in logs)
- Proxy shows "Forwarding request to slave" in logs
- No errors in slave logs when receiving requests

### Timeout Errors

Check:
- Slave has all required environment variables (GitLab/GitHub tokens, LLM config)
- mr-pilot CLI is accessible on the slave
- Network latency between proxy and slave
- Consider increasing timeout in server.js if needed

## Security Considerations

1. **Use Strong Slave Codes**: Generate random, strong codes for production use
2. **Secure WebSocket Connection**: Use `wss://` (WebSocket over TLS) in production
3. **Network Isolation**: Keep slave instances in a secure network segment
4. **Credential Management**: Never expose credentials through the proxy
5. **Access Control**: Restrict who can connect to the proxy HTTP endpoint
6. **Audit Logging**: Monitor connection attempts and authentication failures

## Future Enhancements

Planned features for proxy mode:

- [ ] Multiple active slaves with load balancing
- [ ] Slave health checks and automatic failover
- [ ] Request routing based on platform (GitLab vs GitHub)
- [ ] SSL/TLS support for WebSocket connections
- [ ] Metrics and monitoring
- [ ] Rate limiting per slave

# Feature Plan: MCP Server Proxy Mode

## 1. High-Level Overview
This feature introduces a proxy mode for the MCP server, allowing it to act as a central point for MCP tool calls. In `PROXY_MODE`, the server will accept connections from "slave" MCP instances. Once a slave is authenticated, all incoming MCP tool calls to the proxy server will be forwarded to the connected slave for execution. This enables distributed execution of MCP tasks.

## 2. Environment Variables

### Proxy Server Configuration (`PROXY_MODE=1`)
- `PROXY_MODE`: Set to `1` to enable proxy server functionality.
- `SLAVE_CODES`: A comma-separated list of valid slave authentication codes (e.g., `code1,code2`). The proxy will only accept connections from slaves providing one of these codes.
- `PROXY_WS_PORT`: (Optional) Port for the WebSocket server on the proxy. Defaults to a new port (e.g., 8001) to avoid conflict with the main HTTP server.

### Slave Instance Configuration (`PROXY_SLAVE=1`)
- `PROXY_SLAVE`: Set to `1` to enable slave instance functionality.
- `SLAVE_CODE`: The unique authentication code for this slave instance. Must be present in the `SLAVE_CODES` list of the proxy server.
- `PROXY_SERVER_URL`: The WebSocket URL of the proxy server (e.g., `ws://localhost:8001`).

## 3. Proxy Server Implementation Steps

### 3.1. Initialize WebSocket Server
- Detect `PROXY_MODE=1`.
- Start a new WebSocket server (e.g., using `ws` module) on a configurable port (`PROXY_WS_PORT` or default).
- Add logging for WS server startup.

### 3.2. Handle Slave Connections and Authentication
- On new WebSocket connection:
    - Log connection attempt.
    - Wait for an initial authentication message from the slave containing `SLAVE_CODE`.
    - Validate `SLAVE_CODE` against `SLAVE_CODES` whitelist.
    - If authenticated:
        - Store the slave's WebSocket connection in a global variable (e.g., `connectedSlaveWs`).
        - Log successful authentication and connection.
        - If another slave is already connected, log a warning and close the new connection.
    - If not authenticated:
        - Log authentication failure.
        - Close the connection.
- Handle WebSocket disconnection:
    - Log disconnection.
    - Clear `connectedSlaveWs` if the disconnected slave was the active one.

### 3.3. Modify `dispatchMethod` for Proxying
- In `dispatchMethod`:
    - If `PROXY_MODE=1` and a `connectedSlaveWs` exists:
        - Instead of executing the tool locally, forward the incoming JSON-RPC request (method, params, id) to the `connectedSlaveWs`.
        - Wait for the response from the slave.
        - Return the slave's response as the result of `dispatchMethod`.
        - Add logging for proxying requests and responses.
    - If `PROXY_MODE=1` but no slave is connected, return an error indicating no slave is available.
    - Otherwise (not in `PROXY_MODE` or no slave connected), proceed with local execution as before.

### 3.4. Add Console Logging
- Implement detailed `log` messages for:
    - Proxy WS server startup/shutdown.
    - Slave connection attempts, authentication success/failure.
    - Request forwarding to slave.
    - Responses received from slave.
    - Slave disconnections.

## 4. Slave Instance Implementation Steps

### 4.1. Initialize WebSocket Client
- Detect `PROXY_SLAVE=1`.
- Create a WebSocket client (e.g., using `ws` module) to connect to `PROXY_SERVER_URL`.
- Add logging for WS client startup and connection attempts.

### 4.2. Connect and Authenticate with Proxy
- On successful connection to proxy:
    - Send an authentication message containing `SLAVE_CODE`.
    - Log successful connection and authentication attempt.
- Handle connection errors and disconnections:
    - Log errors and attempt to reconnect after a delay.

### 4.3. Handle Incoming Tool Call Requests from Proxy
- On receiving a message from the proxy:
    - Parse the JSON-RPC request (method, params, id).
    - Log the incoming request.
    - Call the local `dispatchMethod` to execute the tool.
    - Send the result of the local `dispatchMethod` back to the proxy via the WebSocket.
    - Add logging for local tool execution and response sending.

### 4.4. Add Console Logging
- Implement detailed `log` messages for:
    - Slave WS client connection/disconnection.
    - Authentication messages sent.
    - Incoming requests from proxy.
    - Local tool execution.
    - Responses sent back to proxy.

## 5. Testing Strategy
- **Unit Tests:**
    - Test proxy server WS setup and connection handling.
    - Test slave authentication logic.
    - Test `dispatchMethod` behavior in proxy mode (forwarding, no slave connected).
    - Test slave client connection and request handling.
- **Integration Tests:**
    - Start one proxy server and one slave instance.
    - Send an MCP tool call to the proxy and verify it's executed by the slave.
    - Test slave disconnection and reconnection.
    - Test multiple slaves attempting to connect (only first accepted).
    - Test invalid `SLAVE_CODE`.
- **Manual Testing:**
    - Run proxy and slave instances with different configurations and observe logs.
    - Use `mr-pilot` CLI to interact with the proxy server.

# MCP Server Cheatsheet: SSE/HTTP Implementation in Node.js (Pure, No SDKs - Spec v2025-06-18)

<div style="border: 1px solid #ccc; padding: 20px; margin: 10px 0; background-color: #f9f9f9; border-radius: 8px;">
  <strong>Artifact Note:</strong> This is a pure Node.js implementation cheatsheet for an SSE/HTTP-capable MCP server. It uses only built-in modules (e.g., `http`, `https`, `url`, `querystring`) for bidirectional streaming via JSON-RPC 2.0. No external SDKs or npm packages—ideal for lightweight setups. Expand sections for details.
</div>

## Overview
- **MCP Purpose**: Open protocol for AI apps (e.g., LLMs) to access external tools/resources via JSON-RPC 2.0.
- **Focus**: Pure Node.js server for bidirectional streaming (client-to-server via POST, server-to-client via SSE GET).
- **Transports**: SSE + HTTP (streamable; single endpoint preferred) or stdio (local-only). SSE enables real-time server pushes like tool calls/notifications.
- **Key Benefits**: Resumable streams, session management, secure (Origin validation, auth).
- **Node.js Notes**: Uses `http.Server` for endpoints; manual JSON-RPC parsing; EventEmitter for internal messaging.

<details>
<summary><strong>Prerequisites (Click to Expand)</strong></summary>

- **Runtime**: Node.js 20+ (LTS recommended for stability).
- **Modules**: Built-ins only: `http`, `https`, `url`, `querystring`, `crypto` (for sessions), `events` (for pub/sub).
- **Tools**: Familiarity with JSON-RPC, HTTP/SSE; editor like VS Code.
- **Security**: Use `https` in prod; validate origins to prevent rebinding. Run with `node server.js`.

</details>

## Transport Types: SSE/HTTP
| Type | Description | Pros | Cons |
|------|-------------|------|------|
| **Streamable HTTP + SSE** | Single endpoint (`/mcp`) for POST (client → server) & GET (SSE stream server → client). | Bidirectional, resumable, efficient for remote. | Manual SSE flushing; manage sessions. |
| **HTTP Only** | POST for all; no streaming. | Simple. | No real-time pushes. |
| **Stdio** | Local stdin/stdout (not HTTP). | Fast for desktop. | Non-remote. |

- **Protocol Version**: Client sends `MCP-Protocol-Version: 2025-06-18` header; server rejects invalid (400 Bad Request).

<details>
<summary><strong>Server Setup Steps (Click to Expand)</strong></summary>

1. **Init Project**:  
   Create `server.js` and `package.json` (for scripts, no deps):  
   ```json
   // package.json
   {"name": "mcp-server", "scripts": {"start": "node server.js"}}
   ```

2. **Create HTTP Server Instance**:  
   ```javascript
   const http = require('http');
   const url = require('url');
   const { EventEmitter } = require('events');
   const crypto = require('crypto');

   const server = http.createServer(handleRequest);
   const emitter = new EventEmitter();  // For internal pub/sub (e.g., server pushes)

   function handleRequest(req, res) {
     const parsedUrl = url.parse(req.url, true);
     const method = req.method;
     const pathname = parsedUrl.pathname;

     // Validate protocol version
     if (!req.headers['mcp-protocol-version'] || req.headers['mcp-protocol-version'] !== '2025-06-18') {
       res.writeHead(400, { 'Content-Type': 'application/json' });
       res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Protocol Version' } }));
       return;
     }

     if (pathname === '/mcp' || pathname === '/messages/') {
       if (method === 'POST') {
         handlePost(req, res, emitter);
       } else if (method === 'GET') {
         handleSSE(req, res, emitter);
       } else if (method === 'DELETE') {
         handleDelete(req, res);
       } else {
         res.writeHead(405);
         res.end();
       }
     } else {
       res.writeHead(404);
       res.end();
     }
   }
   ```

3. **Define Tools/Resources** (Manual Dispatch):  
   Use a map for methods (tools/resources).  
   ```javascript
   const tools = {
     example_tool: async (params) => `Processed: ${params.param}`,
     // Add async funcs for I/O
   };

   const resources = {
     'example://{id}': (id) => `Resource data for ${id}`,
   };

   // In handlePost: Parse method, dispatch
   async function dispatchMethod(method, params, id, sessionId) {
     if (tools[method]) {
       try {
         const result = await tools[method](params);
         return { jsonrpc: '2.0', result, id };
       } catch (e) {
         return { jsonrpc: '2.0', error: { code: -32000, message: e.message }, id };
       }
     } else if (method.startsWith('resources/')) {
       // Handle resources similarly
     }
     return { jsonrpc: '2.0', error: { code: -32601, message: 'Method Not Found' }, id };
   }
   ```

4. **Setup SSE Transport**:  
   Manual SSE handling with keep-alives.  
   ```javascript
   function handleSSE(req, res, emitter) {
     const sessionId = req.headers['mcp-session-id'];
     if (!sessionId) {
       res.writeHead(401);
       res.end('Missing Session ID');
       return;
     }

     res.writeHead(200, {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache',
       'Connection': 'keep-alive',
       'Access-Control-Allow-Origin': req.headers.origin || '*',  // Validate in prod
     });

     let lastEventId = req.headers['last-event-id'] || '0';
     // Resume logic: Replay events > lastEventId (store in session map)

     const heartbeat = setInterval(() => {
       res.write(`: heartbeat\n\n`);  // Keep-alive
     }, 15000);

     // Listen for server pushes
     const listener = (msg) => {
       if (msg.sessionId === sessionId && msg.eventId > parseInt(lastEventId)) {
         res.write(`id: ${msg.eventId}\ndata: ${JSON.stringify(msg.data)}\n\n`);
         lastEventId = msg.eventId.toString();
       }
     };
     emitter.on('push', listener);

     req.on('close', () => {
       clearInterval(heartbeat);
       emitter.off('push', listener);
       res.end();
     });
   }
   ```

5. **Handle POST (Client Messages)**:  
   Parse JSON-RPC, dispatch, respond or push via SSE.  
   ```javascript
   function handlePost(req, res, emitter) {
     let body = '';
     req.on('data', chunk => body += chunk);
     req.on('end', async () => {
       try {
         const msg = JSON.parse(body);
         if (!msg.jsonrpc || msg.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC');

         const sessionId = req.headers['mcp-session-id'] || generateSessionId();
         res.setHeader('Mcp-Session-Id', sessionId);

         if (msg.id !== undefined) {  // Request
           const response = await dispatchMethod(msg.method, msg.params || {}, msg.id, sessionId);
           res.writeHead(202, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify(response));
         } else {  // Notification
           await dispatchMethod(msg.method, msg.params || {}, null, sessionId);  // Fire-and-forget
           res.writeHead(202);
           res.end();
         }

         // For server-initiated pushes (e.g., notifications)
         emitter.emit('push', { sessionId, eventId: Date.now(), data: { /* response */ } });
       } catch (e) {
         res.writeHead(400, { 'Content-Type': 'application/json' });
         res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse Error' } }));
       }
     });
   }

   function generateSessionId() {
     return crypto.randomUUID();
   }
   ```

6. **Run Server**:  
   ```javascript
   server.listen(8000, '127.0.0.1', () => {
     console.log('MCP Server running on http://127.0.0.1:8000');
   });
   ```
   - For HTTPS: Replace `http` with `https`, provide key/cert.

</details>

## Endpoints
| Method | Path | Purpose | Headers/Body |
|--------|------|---------|--------------|
| **POST** | `/mcp` (or `/messages/`) | Client sends JSON-RPC (requests/notifications). | `Accept: application/json, text/event-stream`<br>Body: JSON-RPC msg |
| **GET** | `/mcp` (or `/sse/`) | Open SSE stream for server pushes (requests/notifications). | `Accept: text/event-stream`<br>`Last-Event-ID` (for resume) |
| **DELETE** | `/mcp` | Terminate session. | `Mcp-Session-Id` header |

- **Responses**:  
  - POST: 202 Accepted (no body) or JSON.  
  - Errors: 400/404/500 with JSON-RPC error body (no `id` for non-requests).  
- **Keep-Alives**: SSE heartbeats every 15s; close after response.

<details>
<summary><strong>Message Formats (JSON-RPC 2.0) (Click to Expand)</strong></summary>

- **Request** (Client → Server):  
  ```json
  {"jsonrpc": "2.0", "method": "tool_name", "params": {"key": "value"}, "id": 1}
  ```
- **Notification** (No response expected): Omit `id`.  
- **Response** (Server → Client):  
  ```json
  {"jsonrpc": "2.0", "result": "value", "id": 1}
  ```
- **Error**:  
  ```json
  {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": 1}
  ```
- **SSE Events**: `data: <JSON>\n\n` (UTF-8); unique `id` for resumability.  
- **Session**: Server assigns `Mcp-Session-Id` in response header; client echoes in headers.

</details>

## Security & Authentication
- **Basics**: Use `https.createServer` in prod; validate `Origin` header (reject mismatches).  
  ```javascript
  // In handleRequest
  if (req.headers.origin !== 'https://trusted-client.com') {
    res.writeHead(403);
    res.end();
    return;
  }
  ```
- **Auth**:  
  - API keys in headers (e.g., `Authorization: Bearer <token>`—verify manually).  
  - Sessions: Store in Map (e.g., `sessions.set(sessionId, { expires: Date.now() + 3600000 })`); expire after 1h inactivity (404).  
- **Best Practices**: User approval for tools; no embedded newlines in msgs; log to console.error.

<details>
<summary><strong>Error Handling (Click to Expand)</strong></summary>

- **Common Codes**: -32600 (Invalid Req), -32601 (Method Not Found), -32700 (Parse Error).  
- **Implementation**:  
  ```javascript
  try {
    // Tool logic (e.g., fetch)
    const response = await fetch(url, { timeout: 30000 });
    if (!response.ok) throw new Error('HTTP Error');
    return await response.json();
  } catch (e) {
    return { jsonrpc: '2.0', error: { code: -32000, message: e.message }, id };
  }
  ```
- **Disconnections**: Don't cancel on close; require explicit `CancelledNotification`. Resume via `Last-Event-ID` (store events per session in a Map).

</details>

<details>
<summary><strong>Example: Full Pure Node.js SSE MCP Server (Click to Expand)</strong></summary>

```javascript
// server.js
const http = require('http');
const url = require('url');
const { EventEmitter } = require('events');
const crypto = require('crypto');

const emitter = new EventEmitter();
const sessions = new Map();  // Simple session store

const server = http.createServer(handleRequest);
server.listen(8000, '127.0.0.1', () => console.log('MCP Server on http://127.0.0.1:8000'));

const tools = {
  echo: async (params) => `Echo: ${params.message}`,
};

async function dispatchMethod(method, params, id, sessionId) {
  if (tools[method]) {
    try {
      const result = await tools[method](params);
      emitter.emit('push', { sessionId, eventId: Date.now(), data: { jsonrpc: '2.0', result, id } });
      return { jsonrpc: '2.0', result, id };
    } catch (e) {
      return { jsonrpc: '2.0', error: { code: -32000, message: e.message }, id };
    }
  }
  return { jsonrpc: '2.0', error: { code: -32601, message: 'Method Not Found' }, id };
}

function handleRequest(req, res) {
  // ... (as in steps above)
  // Integrate dispatchMethod, handlePost, handleSSE
}

function handlePost(req, res, emitter) {
  // ... (as in steps above)
}

function handleSSE(req, res, emitter) {
  // ... (as in steps above)
}

function generateSessionId() {
  return crypto.randomUUID();
}
```
- **Test**: POST to `/mcp` with JSON-RPC (e.g., via curl: `curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"echo","params":{"message":"hi"},"id":1}' http://localhost:8000/mcp`); GET `/mcp` for SSE. Config client: `{"url": "http://localhost:8000/mcp"}`.

For HTTPS or advanced deployment (e.g., PM2), extend with `https` module.

</details>

---

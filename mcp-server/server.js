#!/usr/bin/env node

/**
 * MCP Server for mr-pilot
 * Implements SSE/HTTP transport for Model Context Protocol
 * Integrates with mr-pilot CLI for GitLab MR and GitHub PR reviews
 */

const http = require('http');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

// Configuration
const PORT = process.env.MCP_SERVER_PORT || 8000;
const HOST = process.env.MCP_SERVER_HOST || '127.0.0.1';
const MCP_PROTOCOL_VERSION = '2025-06-18';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Proxy mode configuration
const PROXY_MODE = process.env.PROXY_MODE === '1';
const SLAVE_CODES = process.env.SLAVE_CODES ? process.env.SLAVE_CODES.split(',').map(c => c.trim()) : [];
const PROXY_WS_PORT = process.env.PROXY_WS_PORT || 8001;

// Slave mode configuration
const PROXY_SLAVE = process.env.PROXY_SLAVE === '1';
const SLAVE_CODE = process.env.SLAVE_CODE || '';
const PROXY_SERVER_URL = process.env.PROXY_SERVER_URL || 'ws://localhost:8001';

// Event emitter for SSE pushes
const emitter = new EventEmitter();

// Session storage
const sessions = new Map();

// Proxy mode state
let proxyWsServer = null;
let connectedSlaveWs = null;
const pendingProxyRequests = new Map();

// Slave mode state
let slaveWsClient = null;

/**
 * Logging utilities with timestamps
 */
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [INFO] ${message}`, ...args);
}

function logError(message, ...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${message}`, ...args);
}

function logWarn(message, ...args) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [WARN] ${message}`, ...args);
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Execute mr-pilot CLI
 */
async function executeMrPilot(args) {
  return new Promise((resolve, reject) => {
    log(`Executing mr-pilot with args: ${JSON.stringify(args)}`);

    // Determine the command based on environment
    let command, commandArgs;

    if (NODE_ENV === 'development') {
      // In development, use npm run dev
      command = 'npm';
      commandArgs = ['run', 'dev', '--', ...args];
      log('Running in development mode using npm run dev');
    } else {
      // In production, use the installed binary
      command = 'mr-pilot';
      commandArgs = args;
      log('Running in production mode using mr-pilot binary');
    }

    const cliPath = path.resolve(__dirname, '..');
    log(`Working directory: ${cliPath}`);

    const child = spawn(command, commandArgs, {
      cwd: cliPath,
      env: { ...process.env },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      log(`CLI stdout: ${chunk.trim()}`);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      logWarn(`CLI stderr: ${chunk.trim()}`);
    });

    child.on('error', (error) => {
      logError(`Failed to execute mr-pilot: ${error.message}`);
      reject(new Error(`Failed to execute mr-pilot: ${error.message}`));
    });

    child.on('close', (code) => {
      log(`mr-pilot process exited with code ${code}`);

      if (code === 0) {
        log('mr-pilot execution successful');
        resolve({ stdout, stderr, exitCode: code });
      } else {
        logError(`mr-pilot exited with non-zero code: ${code}`);
        logError(`stderr: ${stderr}`);
        reject(new Error(`mr-pilot exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Parse mr-pilot output to extract review results
 */
function parseMrPilotOutput(output) {
  try {
    log('Parsing mr-pilot output');

    // Extract the JSON result from the output
    // The output formatter returns a structured result
    const lines = output.split('\n');

    // Look for the review report section
    const reportStart = lines.findIndex(line => line.includes('MR REVIEW REPORT') || line.includes('PR REVIEW REPORT'));

    if (reportStart === -1) {
      logWarn('Could not find review report in output');
      return {
        success: false,
        message: 'Review completed but could not parse results',
        rawOutput: output
      };
    }

    // Extract key information
    const goalStatusLine = lines.find(line => line.includes('Goal Status:'));
    const scoreLine = lines.find(line => line.includes('Quality Score:') || line.includes('Score:'));

    let goalStatus = 'unknown';
    let score = 0;
    let issues = [];
    let remarks = '';

    if (goalStatusLine) {
      const match = goalStatusLine.match(/Goal Status:\s*(\w+)/i);
      if (match) goalStatus = match[1].toLowerCase();
    }

    if (scoreLine) {
      const match = scoreLine.match(/Score:\s*(\d+)/i);
      if (match) score = parseInt(match[1], 10);
    }

    // Extract issues
    const issuesStart = lines.findIndex(line => line.includes('Potential Issues:'));
    if (issuesStart !== -1) {
      for (let i = issuesStart + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('📝') || line.includes('Remarks:')) break;
        if (line.match(/^\d+\./)) {
          issues.push(line.replace(/^\d+\.\s*/, ''));
        }
      }
    }

    // Extract remarks
    const remarksStart = lines.findIndex(line => line.includes('Remarks:'));
    if (remarksStart !== -1) {
      for (let i = remarksStart + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('=')) break;
        if (line) remarks += line + ' ';
      }
    }

    log(`Parsed results: status=${goalStatus}, score=${score}, issues=${issues.length}`);

    return {
      success: true,
      goalStatus,
      score,
      issues,
      remarks: remarks.trim(),
      rawOutput: output
    };
  } catch (error) {
    logError(`Failed to parse mr-pilot output: ${error.message}`);
    return {
      success: false,
      message: error.message,
      rawOutput: output
    };
  }
}


/**
 * MCP Tool: review_merge_request
 * Reviews a GitLab MR or GitHub PR using mr-pilot
 */
async function reviewMergeRequest(params) {
  const {
    mrUrlOrId,
    ticketSpec,
    guidelines,
    postComment = false,
    maxDiffChars,
    acceptanceCriteria,
    platform,
    project,
    debug = false
  } = params;

  log(`Tool invoked: review_merge_request with MR/PR: ${mrUrlOrId}`);

  if (!mrUrlOrId) {
    throw new Error('mrUrlOrId parameter is required');
  }

  // Build CLI arguments
  const args = [mrUrlOrId];

  if (ticketSpec) {
    // Write ticket spec to temp file
    const fs = require('fs');
    const tmpFile = path.join('/tmp', `mcp-ticket-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, ticketSpec);
    args.push('--input-file', tmpFile);
    log(`Ticket spec written to ${tmpFile}`);
  }

  if (guidelines) {
    // Write guidelines to temp file
    const fs = require('fs');
    const tmpFile = path.join('/tmp', `mcp-guidelines-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, guidelines);
    args.push('--guidelines-file', tmpFile);
    log(`Guidelines written to ${tmpFile}`);
  }

  if (postComment) {
    args.push('--comment');
    log('Will post comment to MR/PR');
  }

  if (maxDiffChars) {
    args.push('--max-diff-chars', maxDiffChars.toString());
  }

  if (acceptanceCriteria) {
    args.push('--acceptance-criteria', acceptanceCriteria);
  }

  if (platform) {
    args.push('--platform', platform);
  }

  if (project) {
    args.push('--project', project);
  }

  if (debug) {
    args.push('--debug');
  }

  try {
    const result = await executeMrPilot(args);
    const parsed = parseMrPilotOutput(result.stdout);

    log('Review completed successfully');

    return {
      success: parsed.success,
      goalStatus: parsed.goalStatus,
      score: parsed.score,
      issues: parsed.issues,
      remarks: parsed.remarks,
      commentPosted: postComment
    };
  } catch (error) {
    logError(`Review failed: ${error.message}`);
    throw error;
  }
}

/**
 * Define available MCP tools
 */
const tools = {
  review_merge_request: {
    handler: reviewMergeRequest,
    definition: {
      name: 'review_merge_request',
      title: 'Review GitLab MR or GitHub PR',
      description: 'Performs an AI-powered code review of a GitLab Merge Request or GitHub Pull Request using mr-pilot. Returns quality score, goal status, potential issues, and remarks.',
      inputSchema: {
        type: 'object',
        properties: {
          mrUrlOrId: {
            type: 'string',
            description: 'GitLab MR URL (e.g., https://gitlab.com/org/project/-/merge_requests/123), GitHub PR URL (e.g., https://github.com/owner/repo/pull/456), or numeric ID (requires project parameter or default project in env)'
          },
          ticketSpec: {
            type: 'string',
            description: 'Optional ticket/requirement specification text to validate the MR/PR against'
          },
          guidelines: {
            type: 'string',
            description: 'Optional project guidelines text to reduce false positives in the review'
          },
          postComment: {
            type: 'boolean',
            description: 'Whether to post the review as a comment on the MR/PR (default: false)',
            default: false
          },
          maxDiffChars: {
            type: 'number',
            description: 'Maximum characters for diffs (default: 50000). Increase for large MRs/PRs.'
          },
          acceptanceCriteria: {
            type: 'string',
            description: 'Acceptance criteria text to include in the review output'
          },
          platform: {
            type: 'string',
            description: 'Platform override: "gitlab" or "github" (auto-detected from URL or project path)',
            enum: ['gitlab', 'github']
          },
          project: {
            type: 'string',
            description: 'Project path (e.g., "group/subgroup/project" for GitLab or "owner/repo" for GitHub). Required when using numeric ID without default project in env.'
          },
          debug: {
            type: 'boolean',
            description: 'Enable debug mode to see detailed execution information',
            default: false
          }
        },
        required: ['mrUrlOrId']
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the review completed successfully'
          },
          goalStatus: {
            type: 'string',
            description: 'Goal status: "met", "partially_met", or "unmet"'
          },
          score: {
            type: 'number',
            description: 'Quality score from 0 to 100'
          },
          issues: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of potential issues found in the code'
          },
          remarks: {
            type: 'string',
            description: 'Additional remarks and observations from the review'
          },
          commentPosted: {
            type: 'boolean',
            description: 'Whether a comment was posted to the MR/PR'
          }
        }
      }
    }
  }
};

/**
 * Dispatch MCP method calls
 */
async function dispatchMethod(method, params, id) {
  log(`Dispatching method: ${method}`);

  // If in PROXY_MODE and a slave is connected, forward the request
  if (PROXY_MODE && connectedSlaveWs && connectedSlaveWs.readyState === WebSocket.OPEN) {
    log(`[PROXY] Forwarding request to slave: ${method} (id: ${id})`);
    
    return new Promise((resolve, reject) => {
      const requestId = id || crypto.randomUUID();
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id: requestId
      };

      // Store the pending request
      pendingProxyRequests.set(requestId, { resolve, reject, timestamp: Date.now() });

      // Send to slave
      connectedSlaveWs.send(JSON.stringify(request));
      log(`[PROXY] Request sent to slave with id: ${requestId}`);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingProxyRequests.has(requestId)) {
          pendingProxyRequests.delete(requestId);
          reject(new Error('Proxy request timeout'));
        }
      }, 300000);
    });
  }

  // If in PROXY_MODE but no slave connected, return error
  if (PROXY_MODE) {
    logWarn('[PROXY] No slave connected, cannot execute request');
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'No slave server connected to proxy'
      },
      id
    };
  }

  try {
    // Handle tools/list
    if (method === 'tools/list') {
      log('Handling tools/list request');
      const toolsList = Object.values(tools).map(t => t.definition);
      return {
        jsonrpc: '2.0',
        result: {
          tools: toolsList
        },
        id
      };
    }

    // Handle tools/call
    if (method === 'tools/call') {
      const toolName = params.name;
      log(`Handling tools/call request for tool: ${toolName}`);

      if (!tools[toolName]) {
        logError(`Unknown tool: ${toolName}`);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          },
          id
        };
      }

      try {
        const result = await tools[toolName].handler(params.arguments || {});
        log(`Tool ${toolName} executed successfully`);

        return {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ],
            structuredContent: result,
            isError: false
          },
          id
        };
      } catch (error) {
        logError(`Tool ${toolName} execution failed: ${error.message}`);
        return {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}`
              }
            ],
            isError: true
          },
          id
        };
      }
    }

    // Handle initialize
    if (method === 'initialize') {
      log('Handling initialize request');
      return {
        jsonrpc: '2.0',
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          serverInfo: {
            name: 'mr-pilot-mcp-server',
            version: '1.0.0'
          }
        },
        id
      };
    }

    // Unknown method
    logWarn(`Unknown method: ${method}`);
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      },
      id
    };
  } catch (error) {
    logError(`Error dispatching method ${method}: ${error.message}`);
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      },
      id
    };
  }
}

/**
 * Handle POST requests (client messages)
 */
function handlePost(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      log(`POST body received: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);

      const msg = JSON.parse(body);
      log(`Received POST request: ${msg.method || 'notification'} (id: ${msg.id})`);

      if (!msg.jsonrpc || msg.jsonrpc !== '2.0') {
        logError('Invalid JSON-RPC version');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid JSON-RPC version'
          }
        }));
        return;
      }

      const sessionId = req.headers['mcp-session-id'] || generateSessionId();
      res.setHeader('Mcp-Session-Id', sessionId);

      // Store session
      sessions.set(sessionId, {
        created: Date.now(),
        lastActivity: Date.now()
      });

      if (msg.id !== undefined) {
        // Request - needs response
        const response = await dispatchMethod(msg.method, msg.params || {}, msg.id);

        log(`Sending response: ${JSON.stringify(response).substring(0, 200)}${JSON.stringify(response).length > 200 ? '...' : ''}`);

        // For Streamable HTTP, we need to return 200 OK with the JSON-RPC response
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': req.headers.origin || '*'
        });
        res.end(JSON.stringify(response));
        log(`Sent response for request ID ${msg.id} (status: 200)`);
      } else {
        // Notification - no response needed
        await dispatchMethod(msg.method, msg.params || {}, null);
        res.writeHead(204); // No Content
        res.end();
        log('Processed notification (no response)');
      }
    } catch (error) {
      logError(`Error handling POST: ${error.message}`);
      logError(`Stack: ${error.stack}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }));
    }
  });
}

/**
 * Handle SSE (Server-Sent Events) requests
 */
function handleSSE(req, res, emitter) {
  // Get or create session ID
  let sessionId = req.headers['mcp-session-id'];

  if (!sessionId) {
    // Create a new session for SSE connections without session ID
    sessionId = generateSessionId();
    log(`SSE connection without session ID, creating new session: ${sessionId}`);
  } else {
    log(`SSE connection established for session: ${sessionId}`);
  }

  // Store or update session
  sessions.set(sessionId, {
    created: sessions.has(sessionId) ? sessions.get(sessionId).created : Date.now(),
    lastActivity: Date.now()
  });

  log(`Setting SSE headers for session: ${sessionId}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Mcp-Session-Id': sessionId
  });

  let lastEventId = req.headers['last-event-id'] || '0';

  // Send initial connection message with endpoint info
  log(`Sending SSE welcome messages`);
  res.write(`: MCP SSE endpoint connected\n\n`);
  res.write(`: Session ID: ${sessionId}\n\n`);
  res.write(`: Send POST requests to /mcp for JSON-RPC calls\n\n`);
  log(`SSE stream active for session: ${sessionId}`);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
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
    log(`SSE connection closed for session: ${sessionId}`);
    clearInterval(heartbeat);
    emitter.off('push', listener);
    res.end();
  });
}

/**
 * Handle DELETE requests (session termination)
 */
function handleDelete(req, res) {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    log(`Session terminated: ${sessionId}`);
    res.writeHead(200);
    res.end();
  } else {
    logWarn(`DELETE request for unknown session: ${sessionId}`);
    res.writeHead(404);
    res.end();
  }
}

/**
 * Main HTTP request handler
 */
function handleRequest(req, res) {
  // Use WHATWG URL API instead of deprecated url.parse()
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const method = req.method;
  const pathname = requestUrl.pathname;

  log(`${method} ${pathname}`);

  // Log protocol version if present (but don't enforce it)
  // Some MCP clients don't send this header
  const protocolVersion = req.headers['mcp-protocol-version'];
  if (protocolVersion) {
    log(`Protocol version: ${protocolVersion}`);
    if (protocolVersion !== MCP_PROTOCOL_VERSION) {
      logWarn(`Client using different protocol version: ${protocolVersion} (server supports ${MCP_PROTOCOL_VERSION})`);
    }
  } else if (method === 'POST') {
    logWarn(`POST request without Mcp-Protocol-Version header (this is allowed but not recommended)`);
  }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'mr-pilot-mcp-server',
      version: '1.0.0',
      protocol: MCP_PROTOCOL_VERSION,
      activeSessions: sessions.size
    }));
    return;
  }

  // Route to appropriate handler
  // Support multiple endpoint paths for compatibility
  const isValidPath = pathname === '/mcp' || pathname === '/messages/' || pathname === '/' || pathname === '/sse';

  if (isValidPath) {
    if (method === 'POST') {
      handlePost(req, res);
    } else if (method === 'GET') {
      handleSSE(req, res, emitter);
    } else if (method === 'DELETE') {
      handleDelete(req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

/**
 * Start the server
 */
const server = http.createServer(handleRequest);

/**
 * Initialize Proxy WebSocket Server
 */
function initProxyServer() {
  if (!PROXY_MODE) return;

  log('[PROXY] Initializing proxy WebSocket server...');
  
  if (SLAVE_CODES.length === 0) {
    logWarn('[PROXY] No SLAVE_CODES configured. Proxy mode enabled but no slaves can connect.');
  }

  proxyWsServer = new WebSocketServer({ port: PROXY_WS_PORT });

  proxyWsServer.on('listening', () => {
    log(`[PROXY] WebSocket server listening on port ${PROXY_WS_PORT}`);
    log(`[PROXY] Valid slave codes: ${SLAVE_CODES.length} configured`);
  });

  proxyWsServer.on('connection', (ws) => {
    log('[PROXY] New slave connection attempt');
    
    let authenticated = false;
    let authTimeout = setTimeout(() => {
      if (!authenticated) {
        logWarn('[PROXY] Authentication timeout, closing connection');
        ws.close(4000, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle authentication
        if (!authenticated) {
          if (message.type === 'auth' && message.slaveCode) {
            log(`[PROXY] Received authentication attempt with code: ${message.slaveCode.substring(0, 4)}...`);
            
            if (SLAVE_CODES.includes(message.slaveCode)) {
              clearTimeout(authTimeout);
              authenticated = true;
              
              // If another slave is already connected, disconnect it
              if (connectedSlaveWs && connectedSlaveWs.readyState === WebSocket.OPEN) {
                logWarn('[PROXY] Another slave was already connected, disconnecting old slave');
                connectedSlaveWs.close(4001, 'New slave connected');
              }
              
              connectedSlaveWs = ws;
              log('[PROXY] Slave authenticated successfully');
              ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful' }));
            } else {
              logError('[PROXY] Invalid slave code');
              ws.send(JSON.stringify({ type: 'auth_failed', message: 'Invalid slave code' }));
              ws.close(4002, 'Authentication failed');
            }
          } else {
            logWarn('[PROXY] Invalid authentication message format');
            ws.close(4003, 'Invalid authentication message');
          }
          return;
        }

        // Handle responses from slave
        if (message.jsonrpc === '2.0' && message.id) {
          log(`[PROXY] Received response from slave for request id: ${message.id}`);
          
          const pendingRequest = pendingProxyRequests.get(message.id);
          if (pendingRequest) {
            pendingProxyRequests.delete(message.id);
            pendingRequest.resolve(message);
            log(`[PROXY] Response forwarded to client`);
          } else {
            logWarn(`[PROXY] Received response for unknown request id: ${message.id}`);
          }
        }
      } catch (error) {
        logError(`[PROXY] Error processing message from slave: ${error.message}`);
      }
    });

    ws.on('close', () => {
      log('[PROXY] Slave connection closed');
      if (connectedSlaveWs === ws) {
        connectedSlaveWs = null;
        log('[PROXY] Active slave disconnected');
      }
      clearTimeout(authTimeout);
    });

    ws.on('error', (error) => {
      logError(`[PROXY] Slave WebSocket error: ${error.message}`);
    });
  });

  proxyWsServer.on('error', (error) => {
    logError(`[PROXY] WebSocket server error: ${error.message}`);
  });
}

/**
 * Initialize Slave WebSocket Client
 */
function initSlaveClient() {
  if (!PROXY_SLAVE) return;

  log('[SLAVE] Initializing slave WebSocket client...');
  
  if (!SLAVE_CODE) {
    logError('[SLAVE] SLAVE_CODE not configured. Cannot connect to proxy.');
    return;
  }

  function connect() {
    log(`[SLAVE] Connecting to proxy server at ${PROXY_SERVER_URL}...`);
    
    slaveWsClient = new WebSocket(PROXY_SERVER_URL);

    slaveWsClient.on('open', () => {
      log('[SLAVE] Connected to proxy server, sending authentication...');
      slaveWsClient.send(JSON.stringify({
        type: 'auth',
        slaveCode: SLAVE_CODE
      }));
    });

    slaveWsClient.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle authentication response
        if (message.type === 'auth_success') {
          log('[SLAVE] Authentication successful, ready to receive requests');
          return;
        }
        
        if (message.type === 'auth_failed') {
          logError('[SLAVE] Authentication failed, closing connection');
          slaveWsClient.close();
          return;
        }

        // Handle JSON-RPC requests from proxy
        if (message.jsonrpc === '2.0' && message.method) {
          log(`[SLAVE] Received request from proxy: ${message.method} (id: ${message.id})`);
          
          // Execute locally
          const response = await dispatchMethod(message.method, message.params || {}, message.id);
          
          log(`[SLAVE] Sending response back to proxy for id: ${message.id}`);
          slaveWsClient.send(JSON.stringify(response));
        }
      } catch (error) {
        logError(`[SLAVE] Error processing message from proxy: ${error.message}`);
      }
    });

    slaveWsClient.on('close', () => {
      log('[SLAVE] Connection to proxy closed, attempting to reconnect in 5 seconds...');
      slaveWsClient = null;
      setTimeout(connect, 5000);
    });

    slaveWsClient.on('error', (error) => {
      logError(`[SLAVE] WebSocket error: ${error.message}`);
    });
  }

  connect();
}

server.listen(PORT, HOST, () => {
  log('='.repeat(60));
  log(`MCP Server for mr-pilot started successfully`);
  log(`Listening on http://${HOST}:${PORT}`);
  log(`Protocol Version: ${MCP_PROTOCOL_VERSION}`);
  log(`Environment: ${NODE_ENV}`);
  
  if (PROXY_MODE) {
    log(`Mode: PROXY SERVER`);
    log(`Proxy WebSocket Port: ${PROXY_WS_PORT}`);
    log(`Configured slave codes: ${SLAVE_CODES.length}`);
  } else if (PROXY_SLAVE) {
    log(`Mode: SLAVE INSTANCE`);
    log(`Proxy Server URL: ${PROXY_SERVER_URL}`);
  } else {
    log(`Mode: STANDALONE`);
  }
  
  log(`Available tools: ${Object.keys(tools).join(', ')}`);
  log('='.repeat(60));
  log('');
  
  if (!PROXY_SLAVE) {
    log('Environment variables required by mr-pilot:');
    log('  - GITLAB_TOKEN (for GitLab MRs)');
    log('  - GITLAB_API (GitLab API URL)');
    log('  - GITLAB_DEFAULT_PROJECT (optional default project)');
    log('  - GITHUB_TOKEN (for GitHub PRs)');
    log('  - GITHUB_DEFAULT_REPO (optional default repo)');
    log('  - LLM_PROVIDER (openrouter, openai, ollama, azure)');
    log('  - LLM_API_KEY (API key for LLM provider)');
    log('  - LLM_MODEL (model to use)');
    log('  - LLM_API_URL (optional custom API URL)');
    log('  - MAX_DIFF_CHARS (optional, default: 50000)');
    log('');
  }
  
  if (PROXY_MODE) {
    log('Proxy mode environment variables:');
    log('  - PROXY_MODE=1 (enable proxy server)');
    log('  - SLAVE_CODES (comma-separated list of valid slave codes)');
    log('  - PROXY_WS_PORT (WebSocket port, default: 8001)');
    log('');
  }
  
  if (PROXY_SLAVE) {
    log('Slave mode environment variables:');
    log('  - PROXY_SLAVE=1 (enable slave instance)');
    log('  - SLAVE_CODE (authentication code for this slave)');
    log('  - PROXY_SERVER_URL (WebSocket URL of proxy server)');
    log('');
  }
  
  log('Ready to accept MCP client connections.');
  
  // Initialize proxy or slave mode
  if (PROXY_MODE) {
    initProxyServer();
  } else if (PROXY_SLAVE) {
    initSlaveClient();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully...');
  
  if (proxyWsServer) {
    log('[PROXY] Closing WebSocket server...');
    proxyWsServer.close();
  }
  
  if (slaveWsClient && slaveWsClient.readyState === WebSocket.OPEN) {
    log('[SLAVE] Closing WebSocket client...');
    slaveWsClient.close();
  }
  
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully...');
  
  if (proxyWsServer) {
    log('[PROXY] Closing WebSocket server...');
    proxyWsServer.close();
  }
  
  if (slaveWsClient && slaveWsClient.readyState === WebSocket.OPEN) {
    log('[SLAVE] Closing WebSocket client...');
    slaveWsClient.close();
  }
  
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});


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

// Configuration
const PORT = process.env.MCP_SERVER_PORT || 8000;
const HOST = process.env.MCP_SERVER_HOST || '127.0.0.1';
const MCP_PROTOCOL_VERSION = '2025-06-18';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Event emitter for SSE pushes
const emitter = new EventEmitter();

// Session storage
const sessions = new Map();

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

server.listen(PORT, HOST, () => {
  log('='.repeat(60));
  log(`MCP Server for mr-pilot started successfully`);
  log(`Listening on http://${HOST}:${PORT}`);
  log(`Protocol Version: ${MCP_PROTOCOL_VERSION}`);
  log(`Environment: ${NODE_ENV}`);
  log(`Available tools: ${Object.keys(tools).join(', ')}`);
  log('='.repeat(60));
  log('');
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
  log('Ready to accept MCP client connections.');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});


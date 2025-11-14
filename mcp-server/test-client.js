#!/usr/bin/env node

/**
 * Simple test client for the MCP server
 * Tests the tools/list and tools/call endpoints
 */

const http = require('http');

const HOST = process.env.MCP_SERVER_HOST || '127.0.0.1';
const PORT = process.env.MCP_SERVER_PORT || 8000;
const MCP_PROTOCOL_VERSION = '2025-06-18';

let sessionId = null;

/**
 * Make a JSON-RPC request to the MCP server
 */
function makeRequest(method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION
      }
    };

    if (sessionId) {
      options.headers['Mcp-Session-Id'] = sessionId;
    }

    const req = http.request(options, (res) => {
      let body = '';

      // Capture session ID from response
      if (res.headers['mcp-session-id']) {
        sessionId = res.headers['mcp-session-id'];
      }

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Run tests
 */
async function runTests() {
  console.log('MCP Server Test Client');
  console.log('='.repeat(60));
  console.log(`Testing server at http://${HOST}:${PORT}`);
  console.log('');

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize');
    const initResponse = await makeRequest('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    console.log('✓ Initialize successful');
    console.log(`  Server: ${initResponse.result.serverInfo.name} v${initResponse.result.serverInfo.version}`);
    console.log(`  Protocol: ${initResponse.result.protocolVersion}`);
    console.log('');

    // Test 2: List tools
    console.log('Test 2: List tools');
    const listResponse = await makeRequest('tools/list', {}, 2);
    console.log('✓ Tools list retrieved');
    console.log(`  Available tools: ${listResponse.result.tools.length}`);
    listResponse.result.tools.forEach(tool => {
      console.log(`    - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test 3: Call tool (if MR URL provided)
    const mrUrl = process.argv[2];
    if (mrUrl) {
      console.log('Test 3: Call review_merge_request tool');
      console.log(`  MR/PR: ${mrUrl}`);
      
      const callResponse = await makeRequest('tools/call', {
        name: 'review_merge_request',
        arguments: {
          mrUrlOrId: mrUrl,
          debug: true
        }
      }, 3);

      if (callResponse.result.isError) {
        console.log('✗ Tool execution failed');
        console.log(`  Error: ${callResponse.result.content[0].text}`);
      } else {
        console.log('✓ Tool execution successful');
        const result = callResponse.result.structuredContent;
        console.log(`  Goal Status: ${result.goalStatus}`);
        console.log(`  Score: ${result.score}/100`);
        console.log(`  Issues: ${result.issues.length}`);
        if (result.issues.length > 0) {
          result.issues.forEach((issue, idx) => {
            console.log(`    ${idx + 1}. ${issue}`);
          });
        }
        console.log(`  Remarks: ${result.remarks.substring(0, 100)}...`);
      }
    } else {
      console.log('Test 3: Skipped (no MR/PR URL provided)');
      console.log('  Usage: node test-client.js <mr_url>');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('All tests completed successfully!');

  } catch (error) {
    console.error('');
    console.error('✗ Test failed:', error.message);
    console.error('');
    console.error('Make sure the MCP server is running:');
    console.error('  cd mcp-server && npm start');
    process.exit(1);
  }
}

runTests();


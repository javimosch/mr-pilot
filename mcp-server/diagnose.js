#!/usr/bin/env node

/**
 * Diagnostic tool for MCP server
 * Checks server health and connectivity
 */

const http = require('http');

const HOST = process.env.MCP_SERVER_HOST || '127.0.0.1';
const PORT = process.env.MCP_SERVER_PORT || 8000;

console.log('MCP Server Diagnostic Tool');
console.log('='.repeat(60));
console.log(`Testing server at http://${HOST}:${PORT}`);
console.log('');

// Test 1: Health check
console.log('Test 1: Health Check');
http.get(`http://${HOST}:${PORT}/health`, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const health = JSON.parse(body);
      console.log('✓ Server is running');
      console.log(`  Status: ${health.status}`);
      console.log(`  Server: ${health.server}`);
      console.log(`  Version: ${health.version}`);
      console.log(`  Protocol: ${health.protocol}`);
      console.log(`  Active Sessions: ${health.activeSessions}`);
      console.log('');
      
      // Test 2: SSE connection
      console.log('Test 2: SSE Connection');
      const sseReq = http.get(`http://${HOST}:${PORT}/mcp`, (sseRes) => {
        console.log(`✓ SSE connection established (status: ${sseRes.statusCode})`);
        console.log(`  Session ID: ${sseRes.headers['mcp-session-id']}`);
        console.log(`  Content-Type: ${sseRes.headers['content-type']}`);
        console.log('');
        console.log('Receiving SSE events (will show first 3):');
        
        let eventCount = 0;
        sseRes.on('data', chunk => {
          if (eventCount < 3) {
            console.log(`  ${chunk.toString().trim()}`);
            eventCount++;
          }
          if (eventCount === 3) {
            console.log('');
            console.log('✓ SSE connection working correctly');
            console.log('');
            sseReq.destroy();
            
            // Test 3: POST request
            testPost();
          }
        });
      });
      
      sseReq.on('error', (error) => {
        console.error('✗ SSE connection failed:', error.message);
      });
      
    } catch (error) {
      console.error('✗ Failed to parse health response:', error.message);
    }
  });
}).on('error', (error) => {
  console.error('✗ Server is not running or not accessible');
  console.error(`  Error: ${error.message}`);
  console.error('');
  console.error('Make sure the server is running:');
  console.error('  cd mcp-server && npm start');
  process.exit(1);
});

function testPost() {
  console.log('Test 3: POST Request (initialize)');
  
  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'diagnostic-tool',
        version: '1.0.0'
      }
    }
  });
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Mcp-Protocol-Version': '2025-06-18'
    }
  };
  
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(body);
        console.log(`✓ POST request successful (status: ${res.statusCode})`);
        console.log(`  Session ID: ${res.headers['mcp-session-id']}`);
        console.log(`  Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
        console.log(`  Protocol: ${response.result.protocolVersion}`);
        console.log('');
        
        // Test 4: List tools
        testListTools(res.headers['mcp-session-id']);
      } catch (error) {
        console.error('✗ Failed to parse response:', error.message);
        console.error('  Response:', body);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('✗ POST request failed:', error.message);
  });
  
  req.write(data);
  req.end();
}

function testListTools(sessionId) {
  console.log('Test 4: List Tools');
  
  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Mcp-Protocol-Version': '2025-06-18',
      'Mcp-Session-Id': sessionId
    }
  };
  
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(body);
        console.log(`✓ Tools list retrieved (status: ${res.statusCode})`);
        console.log(`  Available tools: ${response.result.tools.length}`);
        response.result.tools.forEach(tool => {
          console.log(`    - ${tool.name}: ${tool.description.substring(0, 60)}...`);
        });
        console.log('');
        console.log('='.repeat(60));
        console.log('All diagnostic tests passed! ✓');
        console.log('');
        console.log('The MCP server is working correctly.');
        console.log('If your MCP client still cannot connect, check:');
        console.log('  1. Client configuration (URL, transport type)');
        console.log('  2. Client logs for specific error messages');
        console.log('  3. Firewall/network settings');
        process.exit(0);
      } catch (error) {
        console.error('✗ Failed to parse response:', error.message);
        console.error('  Response:', body);
        process.exit(1);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('✗ Tools list request failed:', error.message);
    process.exit(1);
  });
  
  req.write(data);
  req.end();
}


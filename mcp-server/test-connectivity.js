#!/usr/bin/env node

/**
 * MCP Server Connectivity Test Script
 * 
 * Tests connectivity and functionality of a remote MCP server
 * 
 * Usage:
 *   node test-connectivity.js <url> [bearer-token] [--custom-header=<name>]
 *   
 * Examples:
 *   node test-connectivity.js http://localhost:8000
 *   node test-connectivity.js https://mr-pilot.example.com eyJhbGc...
 *   node test-connectivity.js https://mr-pilot.example.com/mcp "Bearer eyJhbGc..."
 *   node test-connectivity.js https://mr-pilot.example.com mytoken --custom-header=x-api-key
 */

const http = require('http');
const https = require('https');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Icons
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  testing: '🔍',
  server: '🚀',
  auth: '🔐',
  time: '⏱️'
};

/**
 * Print colored message
 */
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(title) {
  console.log('');
  print('═'.repeat(60), 'cyan');
  print(`  ${title}`, 'bright');
  print('═'.repeat(60), 'cyan');
}

/**
 * Print test result
 */
function printResult(icon, label, value, success = true) {
  const color = success ? 'green' : 'red';
  const valueColor = success ? 'cyan' : 'yellow';
  console.log(`${icon} ${colors[color]}${label}:${colors.reset} ${colors[valueColor]}${value}${colors.reset}`);
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000
    };

    const startTime = Date.now();
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          duration
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Test health endpoint
 */
async function testHealth(baseUrl, headers) {
  const url = baseUrl.replace(/\/mcp\/?$/, '') + '/health';
  
  try {
    const response = await makeRequest(url, { headers });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      printResult(icons.success, 'Health Check', 'OK', true);
      printResult(icons.time, 'Response Time', `${response.duration}ms`, true);
      printResult(icons.info, 'Server', data.server || 'unknown', true);
      printResult(icons.info, 'Version', data.version || 'unknown', true);
      printResult(icons.info, 'Protocol', data.protocol || 'unknown', true);
      printResult(icons.info, 'Active Sessions', data.activeSessions || 0, true);
      return true;
    } else {
      printResult(icons.error, 'Health Check', `Failed (${response.statusCode})`, false);
      print(`Response: ${response.body}`, 'gray');
      return false;
    }
  } catch (error) {
    printResult(icons.error, 'Health Check', `Error: ${error.message}`, false);
    return false;
  }
}

/**
 * Test MCP initialize
 */
async function testInitialize(baseUrl, headers) {
  const url = baseUrl.endsWith('/mcp') ? baseUrl : baseUrl + '/mcp';
  
  const payload = {
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'connectivity-test',
        version: '1.0.0'
      }
    }
  };

  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      
      if (data.result) {
        printResult(icons.success, 'Initialize', 'OK', true);
        printResult(icons.time, 'Response Time', `${response.duration}ms`, true);
        printResult(icons.info, 'Protocol Version', data.result.protocolVersion || 'unknown', true);
        printResult(icons.info, 'Server Name', data.result.serverInfo?.name || 'unknown', true);
        printResult(icons.info, 'Server Version', data.result.serverInfo?.version || 'unknown', true);
        return true;
      } else if (data.error) {
        printResult(icons.error, 'Initialize', `Error: ${data.error.message}`, false);
        return false;
      }
    } else if (response.statusCode === 401) {
      printResult(icons.error, 'Initialize', 'Unauthorized - Invalid or missing bearer token', false);
      return false;
    } else {
      printResult(icons.error, 'Initialize', `Failed (${response.statusCode})`, false);
      print(`Response: ${response.body}`, 'gray');
      return false;
    }
  } catch (error) {
    printResult(icons.error, 'Initialize', `Error: ${error.message}`, false);
    return false;
  }
}

/**
 * Test tools/list
 */
async function testToolsList(baseUrl, headers) {
  const url = baseUrl.endsWith('/mcp') ? baseUrl : baseUrl + '/mcp';
  
  const payload = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2
  };

  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      
      if (data.result && data.result.tools) {
        printResult(icons.success, 'Tools List', 'OK', true);
        printResult(icons.time, 'Response Time', `${response.duration}ms`, true);
        printResult(icons.info, 'Available Tools', data.result.tools.length, true);
        
        if (data.result.tools.length > 0) {
          console.log('');
          print('  Available Tools:', 'cyan');
          data.result.tools.forEach(tool => {
            print(`    • ${tool.name}`, 'gray');
            print(`      ${tool.description}`, 'gray');
          });
        }
        
        return true;
      } else if (data.error) {
        printResult(icons.error, 'Tools List', `Error: ${data.error.message}`, false);
        return false;
      }
    } else {
      printResult(icons.error, 'Tools List', `Failed (${response.statusCode})`, false);
      print(`Response: ${response.body}`, 'gray');
      return false;
    }
  } catch (error) {
    printResult(icons.error, 'Tools List', `Error: ${error.message}`, false);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${colors.bright}MCP Server Connectivity Test${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node test-connectivity.js <url> [bearer-token] [--custom-header=<name>]

${colors.cyan}Examples:${colors.reset}
  node test-connectivity.js http://localhost:8000
  node test-connectivity.js https://mcp.example.com eyJhbGc...
  node test-connectivity.js https://mcp.example.com/mcp "Bearer eyJhbGc..."
  node test-connectivity.js https://mcp.example.com mytoken --custom-header=x-api-key

${colors.cyan}Arguments:${colors.reset}
  url                     MCP server URL (required)
  bearer-token            Optional bearer token for authentication
  --custom-header=<name>  Use custom header instead of Authorization header

${colors.cyan}Tests performed:${colors.reset}
  1. Health Check    - Verify server is responding
  2. Initialize      - Test MCP protocol initialization
  3. Tools List      - Retrieve available tools
    `);
    process.exit(0);
  }

  const baseUrl = args[0];
  let bearerToken = args[1];
  let customHeader = '';

  // Parse custom header flag
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--custom-header=')) {
      customHeader = args[i].split('=')[1];
      // If custom header is specified, the token is the previous arg
      if (i > 1) {
        bearerToken = args[i - 1];
      }
      break;
    }
  }

  // Parse bearer token
  let token = bearerToken;
  if (token && token.toLowerCase().startsWith('bearer ')) {
    token = token.substring(7);
  }

  // Setup headers
  const headers = {};
  if (token) {
    if (customHeader) {
      headers[customHeader] = token;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  printHeader(`${icons.server} MCP Server Connectivity Test`);
  console.log('');
  printResult(icons.info, 'Target URL', baseUrl, true);
  printResult(icons.auth, 'Authentication', token ? (customHeader ? `Custom Header (${customHeader})` : 'Bearer Token') : 'Disabled', true);
  console.log('');

  let allPassed = true;

  // Test 1: Health Check
  printHeader(`${icons.testing} Test 1: Health Check`);
  const healthPassed = await testHealth(baseUrl, headers);
  allPassed = allPassed && healthPassed;

  // Test 2: Initialize
  printHeader(`${icons.testing} Test 2: MCP Initialize`);
  const initPassed = await testInitialize(baseUrl, headers);
  allPassed = allPassed && initPassed;

  // Test 3: Tools List
  printHeader(`${icons.testing} Test 3: Tools List`);
  const toolsPassed = await testToolsList(baseUrl, headers);
  allPassed = allPassed && toolsPassed;

  // Summary
  printHeader(`${allPassed ? icons.success : icons.error} Test Summary`);
  console.log('');
  printResult(
    allPassed ? icons.success : icons.error,
    'Overall Result',
    allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED',
    allPassed
  );
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  print(`\n${icons.error} Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Test script for proxy mode functionality
 * 
 * This script:
 * 1. Starts a proxy server on port 8000 (HTTP) and 8001 (WebSocket)
 * 2. Starts a slave server on port 9000 (HTTP) with connection to proxy
 * 3. Tests the proxy by sending requests to port 8000
 * 4. Verifies that requests are forwarded to the slave and responses come back
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_HTTP_PORT = 8000;
const PROXY_WS_PORT = 8001;
const SLAVE_HTTP_PORT = 9000;
const SLAVE_CODE = 'test-slave-code-123';
const TEST_TIMEOUT = 60000; // 60 seconds

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}[TEST] ${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function info(message) {
  log(message, colors.cyan);
}

// Load .env file if it exists
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    
    return env;
  }
  return {};
}

// Start proxy server
function startProxyServer() {
  return new Promise((resolve, reject) => {
    info(`Starting proxy server on ports ${PROXY_HTTP_PORT} (HTTP) and ${PROXY_WS_PORT} (WS)...`);
    
    const env = {
      ...process.env,
      ...loadEnv(),
      PROXY_MODE: '1',
      SLAVE_CODES: SLAVE_CODE,
      MCP_SERVER_PORT: PROXY_HTTP_PORT.toString(),
      PROXY_WS_PORT: PROXY_WS_PORT.toString(),
      NODE_ENV: 'test'
    };

    const proxyServer = spawn('node', ['server.js'], {
      cwd: __dirname,
      env
    });

    let started = false;

    proxyServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`${colors.blue}[PROXY]${colors.reset} ${output.trim()}`);
      
      if (output.includes('Ready to accept MCP client connections') && !started) {
        started = true;
        success('Proxy server started successfully');
        // Wait a bit for WebSocket server to be fully ready
        setTimeout(() => resolve(proxyServer), 1000);
      }
    });

    proxyServer.stderr.on('data', (data) => {
      console.error(`${colors.blue}[PROXY ERROR]${colors.reset} ${data.toString().trim()}`);
    });

    proxyServer.on('error', (err) => {
      error(`Failed to start proxy server: ${err.message}`);
      reject(err);
    });

    proxyServer.on('exit', (code) => {
      if (code !== 0 && !started) {
        reject(new Error(`Proxy server exited with code ${code}`));
      }
    });

    // Timeout
    setTimeout(() => {
      if (!started) {
        reject(new Error('Proxy server startup timeout'));
      }
    }, 10000);
  });
}

// Start slave server
function startSlaveServer() {
  return new Promise((resolve, reject) => {
    info(`Starting slave server on port ${SLAVE_HTTP_PORT}...`);
    
    const env = {
      ...process.env,
      ...loadEnv(),
      PROXY_SLAVE: '1',
      SLAVE_CODE: SLAVE_CODE,
      PROXY_SERVER_URL: `ws://localhost:${PROXY_WS_PORT}`,
      MCP_SERVER_PORT: SLAVE_HTTP_PORT.toString(),
      NODE_ENV: 'test'
    };

    const slaveServer = spawn('node', ['server.js'], {
      cwd: __dirname,
      env
    });

    let started = false;
    let authenticated = false;

    slaveServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`${colors.yellow}[SLAVE]${colors.reset} ${output.trim()}`);
      
      if (output.includes('Ready to accept MCP client connections') && !started) {
        started = true;
        success('Slave server started successfully');
      }
      
      if (output.includes('Authentication successful') && !authenticated) {
        authenticated = true;
        success('Slave authenticated with proxy');
        // Wait a bit for everything to settle
        setTimeout(() => resolve(slaveServer), 500);
      }
    });

    slaveServer.stderr.on('data', (data) => {
      console.error(`${colors.yellow}[SLAVE ERROR]${colors.reset} ${data.toString().trim()}`);
    });

    slaveServer.on('error', (err) => {
      error(`Failed to start slave server: ${err.message}`);
      reject(err);
    });

    slaveServer.on('exit', (code) => {
      if (code !== 0 && !started) {
        reject(new Error(`Slave server exited with code ${code}`));
      }
    });

    // Timeout
    setTimeout(() => {
      if (!authenticated) {
        reject(new Error('Slave server authentication timeout'));
      }
    }, 15000);
  });
}

// Test MCP request
function testMCPRequest(port, testName) {
  return new Promise((resolve, reject) => {
    info(`Testing ${testName}...`);
    
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };

    const data = JSON.stringify(request);
    
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Mcp-Protocol-Version': '2025-06-18'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (response.jsonrpc === '2.0' && response.result && response.result.tools) {
            success(`${testName} - Received valid response with ${response.result.tools.length} tools`);
            resolve(response);
          } else if (response.error) {
            error(`${testName} - Received error: ${response.error.message}`);
            reject(new Error(response.error.message));
          } else {
            error(`${testName} - Invalid response format`);
            reject(new Error('Invalid response format'));
          }
        } catch (err) {
          error(`${testName} - Failed to parse response: ${err.message}`);
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      error(`${testName} - Request failed: ${err.message}`);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// Test health check
function testHealthCheck(port, serverName) {
  return new Promise((resolve, reject) => {
    info(`Testing health check for ${serverName}...`);
    
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (response.status === 'ok') {
            success(`${serverName} health check passed`);
            resolve(response);
          } else {
            error(`${serverName} health check failed`);
            reject(new Error('Health check failed'));
          }
        } catch (err) {
          error(`${serverName} - Failed to parse health response: ${err.message}`);
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      error(`${serverName} health check failed: ${err.message}`);
      reject(err);
    });

    req.end();
  });
}

// Main test flow
async function runTests() {
  let proxyServer = null;
  let slaveServer = null;
  let testsPassed = true;

  try {
    log('='.repeat(60), colors.cyan);
    log('MCP Proxy Mode Integration Test', colors.cyan);
    log('='.repeat(60), colors.cyan);
    log('');

    // Start proxy server
    proxyServer = await startProxyServer();
    log('');

    // Start slave server
    slaveServer = await startSlaveServer();
    log('');

    // Wait a bit for everything to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run tests
    log('Running tests...', colors.cyan);
    log('');

    // Test 1: Health check on proxy
    await testHealthCheck(PROXY_HTTP_PORT, 'Proxy Server');
    log('');

    // Test 2: Health check on slave
    await testHealthCheck(SLAVE_HTTP_PORT, 'Slave Server');
    log('');

    // Test 3: Direct request to slave (should work)
    await testMCPRequest(SLAVE_HTTP_PORT, 'Direct request to slave');
    log('');

    // Test 4: Request to proxy (should be forwarded to slave)
    await testMCPRequest(PROXY_HTTP_PORT, 'Proxied request through proxy to slave');
    log('');

    log('='.repeat(60), colors.green);
    log('ALL TESTS PASSED!', colors.green);
    log('='.repeat(60), colors.green);

  } catch (err) {
    testsPassed = false;
    log('='.repeat(60), colors.red);
    log(`TEST FAILED: ${err.message}`, colors.red);
    log('='.repeat(60), colors.red);
  } finally {
    // Cleanup
    log('');
    info('Cleaning up...');
    
    if (slaveServer) {
      info('Stopping slave server...');
      slaveServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (proxyServer) {
      info('Stopping proxy server...');
      proxyServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    success('Cleanup complete');
    
    process.exit(testsPassed ? 0 : 1);
  }
}

// Run the tests
runTests().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});

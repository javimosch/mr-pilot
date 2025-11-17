#!/bin/bash

# MCP Server Connectivity Test Examples
# 
# This script shows various ways to test your MCP server

echo "═══════════════════════════════════════════════════════════"
echo "  MCP Server Connectivity Test Examples"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Example 1: Test local server without auth
echo "Example 1: Local server without authentication"
echo "Command: npm run test:connectivity http://localhost:8000"
echo ""

# Example 2: Test local server with auth
echo "Example 2: Local server with authentication"
echo "Command: npm run test:connectivity http://localhost:8000 your_token_here"
echo ""

# Example 3: Test remote server with auth
echo "Example 3: Remote server with authentication"
echo "Command: npm run test:connectivity https://mcp.example.com your_token_here"
echo ""

# Example 4: Test with Bearer prefix
echo "Example 4: Using Bearer prefix"
echo "Command: npm run test:connectivity https://mcp.example.com \"Bearer your_token_here\""
echo ""

# Example 5: Test production server
echo "Example 5: Production server (Coolify deployment)"
echo "Command: npm run test:connectivity https://mr-pilot-mcp-server-proxy.coolify.intrane.fr eyJhbGc..."
echo ""

# Example 6: Help
echo "Example 6: Show help"
echo "Command: npm run test:connectivity -- --help"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "To run any example, use the command shown above."
echo "Replace 'your_token_here' with your actual bearer token."
echo ""

# Multi-stage build for MCP server with mr-pilot

# Stage 1: Build mr-pilot
FROM node:20-alpine AS mr-pilot-builder

WORKDIR /build

# Copy mr-pilot package files
COPY package.json package-lock.json ./
COPY src ./src
COPY bin ./bin

# Install dependencies and prepare for production
RUN npm ci --only=production

# Stage 2: MCP Server
FROM node:20-alpine

# Install mr-pilot globally from the build stage
WORKDIR /tmp/mr-pilot
COPY --from=mr-pilot-builder /build ./
RUN npm install -g . && \
    rm -rf /tmp/mr-pilot

# Set up MCP server
WORKDIR /app

# Copy MCP server files
COPY mcp-server/package.json mcp-server/package-lock.json* ./
COPY mcp-server/server.js ./

# Install MCP server dependencies
RUN npm ci --only=production

# Set production environment
ENV NODE_ENV=production

# Expose MCP server port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run the MCP server
CMD ["node", "server.js"]


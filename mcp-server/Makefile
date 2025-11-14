.PHONY: help build up down restart logs shell health test clean rebuild

# Default target
help:
	@echo "MCP Server for mr-pilot - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build       Build the Docker image"
	@echo "  up          Start the server (detached)"
	@echo "  down        Stop and remove containers"
	@echo "  restart     Restart the server"
	@echo "  logs        Follow server logs"
	@echo "  shell       Open shell in container"
	@echo "  health      Check server health"
	@echo "  test        Run diagnostic tests"
	@echo "  clean       Remove containers, images, and volumes"
	@echo "  rebuild     Clean rebuild from scratch"
	@echo "  env         Copy environment template"
	@echo ""

# Build the Docker image
build:
	@echo "Building Docker image..."
	docker compose build

# Start the server
up:
	@echo "Starting MCP server..."
	docker compose up -d
	@echo "Server started. Check logs with: make logs"

push:	
	@echo "Pushing Docker image..."
	docker compose push


# Stop the server
down:
	@echo "Stopping MCP server..."
	docker compose down

# Restart the server
restart:
	@echo "Restarting MCP server..."
	docker compose restart

# Follow logs
logs:
	docker compose logs -f

# Open shell in container
shell:
	docker compose exec mcp-server sh

# Check health
health:
	@echo "Checking server health..."
	@curl -s http://localhost:8000/health | jq . || echo "Server not responding"

# Run diagnostic tests
test:
	@echo "Running diagnostic tests..."
	@docker compose exec mcp-server node -e "require('http').get('http://localhost:8000/health', (r) => { let b=''; r.on('data', d => b+=d); r.on('end', () => console.log(JSON.parse(b))); })"

# Clean up everything
clean:
	@echo "Cleaning up Docker resources..."
	docker compose down -v --rmi all

# Rebuild from scratch
rebuild: clean
	@echo "Rebuilding from scratch..."
	docker compose build --no-cache
	docker compose up -d

# Copy environment template
env:
	@if [ ! -f .env ]; then \
		cp docker.env.example .env; \
		echo "Created .env file. Please edit it with your credentials."; \
	else \
		echo ".env file already exists. Not overwriting."; \
	fi

# Development mode (local Node.js)
dev:
	@echo "Starting in development mode (local Node.js)..."
	npm start

# Production mode (local Node.js)
prod:
	@echo "Starting in production mode (local Node.js)..."
	NODE_ENV=production npm start

# Show container status
status:
	docker compose ps

# Show resource usage
stats:
	docker stats mr-pilot-mcp-server --no-stream

# View last 100 log lines
logs-tail:
	docker compose logs --tail=100

# Check mr-pilot version in container
version:
	@echo "Checking mr-pilot version in container..."
	@docker compose exec mcp-server mr-pilot --version || echo "mr-pilot not found or container not running"

# Install dependencies (for local development)
install:
	npm install

# Run local test client
test-local:
	node test-client.js

# Run local diagnostic
diagnose:
	node diagnose.js


# Docker Deployment Guide

This guide explains how to run the MCP server for mr-pilot using Docker and Docker Compose.

## Quick Start

1. **Copy the environment file**:
   ```bash
   cd mcp-server
   cp docker.env.example .env
   ```

2. **Edit `.env` with your actual credentials**:
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Build and start the container**:
   ```bash
   docker compose up -d
   ```

4. **Check the logs**:
   ```bash
   docker compose logs -f
   ```

5. **Test the server**:
   ```bash
   curl http://localhost:8000/health
   ```

## Architecture

The Docker setup uses a multi-stage build:

1. **Stage 1 (mr-pilot-builder)**: Builds mr-pilot from source
2. **Stage 2 (mcp-server)**: Installs mr-pilot globally and runs the MCP server

This ensures:
- mr-pilot is available as a global binary (`NODE_ENV=production`)
- Minimal final image size
- Production-ready configuration

## Environment Variables

All environment variables are configured in the `.env` file:

### Required Variables

```bash
# GitLab (if using GitLab MRs)
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_API=https://gitlab.com/api/v4

# GitHub (if using GitHub PRs)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# LLM Configuration
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
LLM_MODEL=openai/gpt-oss-120b:exacto
```

### Optional Variables

```bash
GITLAB_DEFAULT_PROJECT=group/subgroup/project
GITHUB_DEFAULT_REPO=owner/repo
LLM_API_URL=https://custom-api.com
MAX_DIFF_CHARS=50000
MCP_SERVER_PORT=8000
MCP_SERVER_HOST=0.0.0.0
```

## Docker Compose Commands

### Start the server
```bash
docker compose up -d
```

### Stop the server
```bash
docker compose down
```

### View logs
```bash
# Follow logs
docker compose logs -f

# View last 100 lines
docker compose logs --tail=100
```

### Restart the server
```bash
docker compose restart
```

### Rebuild after code changes
```bash
docker compose up -d --build
```

### Check status
```bash
docker compose ps
```

### Execute commands in the container
```bash
# Check mr-pilot version
docker compose exec mcp-server mr-pilot --version

# Access shell
docker compose exec mcp-server sh
```

## Health Checks

The container includes automatic health checks:

```bash
# Check health status
docker compose ps

# View health check logs
docker inspect mr-pilot-mcp-server | grep -A 10 Health
```

Health check endpoint: `http://localhost:8000/health`

## Resource Limits

The compose file includes resource limits:

- **CPU Limit**: 2 cores
- **Memory Limit**: 2GB
- **CPU Reservation**: 0.5 cores
- **Memory Reservation**: 512MB

Adjust these in `compose.yml` based on your needs:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'        # Increase for heavy workloads
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

## Networking

### Access from Host

The server is accessible at:
- **URL**: `http://localhost:8000/mcp`
- **Health**: `http://localhost:8000/health`

### Access from Other Containers

If you have other containers that need to access the MCP server:

```yaml
services:
  your-app:
    networks:
      - mcp-network
    environment:
      - MCP_SERVER_URL=http://mcp-server:8000/mcp

networks:
  mcp-network:
    external: true
```

### Change Port

To use a different port, edit `compose.yml`:

```yaml
ports:
  - "9000:8000"  # Host:Container
```

Then update your MCP client configuration to use `http://localhost:9000/mcp`

## Logs

Logs are configured with rotation:
- **Max size**: 10MB per file
- **Max files**: 3 files
- **Driver**: json-file

View logs:
```bash
# All logs
docker compose logs

# Specific service
docker compose logs mcp-server

# Follow logs
docker compose logs -f

# Last N lines
docker compose logs --tail=50
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs

# Check if port is in use
lsof -i :8000

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Environment variables not working

```bash
# Verify .env file exists
ls -la .env

# Check environment variables in container
docker compose exec mcp-server env | grep -E 'GITLAB|GITHUB|LLM'

# Restart after changing .env
docker compose down
docker compose up -d
```

### Health check failing

```bash
# Check health endpoint manually
docker compose exec mcp-server wget -O- http://localhost:8000/health

# Check server logs
docker compose logs mcp-server

# Verify server is listening
docker compose exec mcp-server netstat -tlnp | grep 8000
```

### mr-pilot not found

```bash
# Verify mr-pilot is installed
docker compose exec mcp-server which mr-pilot

# Check mr-pilot version
docker compose exec mcp-server mr-pilot --version

# Rebuild if needed
docker compose build --no-cache
```

## Production Deployment

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c compose.yml mcp

# Check services
docker service ls

# View logs
docker service logs mcp_mcp-server
```

### Using Kubernetes

Convert compose file to Kubernetes manifests:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.31.2/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert
kompose convert -f compose.yml

# Deploy
kubectl apply -f .
```

### Security Considerations

1. **Never commit `.env` file** - it contains secrets
2. **Use secrets management** in production:
   ```yaml
   secrets:
     gitlab_token:
       external: true
   ```
3. **Enable HTTPS** - use a reverse proxy (nginx, traefik)
4. **Restrict network access** - use firewall rules
5. **Regular updates** - rebuild images regularly

## Monitoring

### Prometheus Metrics (Future Enhancement)

Add metrics endpoint to server.js and expose:

```yaml
ports:
  - "8000:8000"  # MCP server
  - "9090:9090"  # Metrics
```

### Log Aggregation

Use a log driver for centralized logging:

```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "tcp://logserver:514"
```

## Backup and Restore

The MCP server is stateless, but you may want to backup:

1. **Environment configuration**:
   ```bash
   cp .env .env.backup
   ```

2. **Docker volumes** (if you add any):
   ```bash
   docker run --rm -v mcp-data:/data -v $(pwd):/backup alpine tar czf /backup/mcp-data.tar.gz /data
   ```

## Updates

### Update mr-pilot

1. Pull latest code:
   ```bash
   cd /path/to/gitlab-mr-review
   git pull
   ```

2. Rebuild and restart:
   ```bash
   cd mcp-server
   docker compose up -d --build
   ```

### Update base image

Edit `Dockerfile` to use a newer Node.js version:
```dockerfile
FROM node:22-alpine  # Update version
```

Then rebuild:
```bash
docker compose build --no-cache
docker compose up -d
```


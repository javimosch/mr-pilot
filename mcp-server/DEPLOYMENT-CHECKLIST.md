# Deployment Checklist

Use this checklist to ensure a successful deployment of the MCP server.

## Pre-Deployment

### 1. Prerequisites
- [ ] Docker and Docker Compose installed (for Docker deployment)
- [ ] Node.js 14+ installed (for local deployment)
- [ ] GitLab personal access token (if using GitLab)
- [ ] GitHub personal access token (if using GitHub)
- [ ] LLM API key (OpenRouter, OpenAI, etc.)

### 2. Configuration
- [ ] Copy environment template: `cp docker.env.example .env`
- [ ] Set `GITLAB_TOKEN` (if using GitLab)
- [ ] Set `GITLAB_API` URL
- [ ] Set `GITHUB_TOKEN` (if using GitHub)
- [ ] Set `LLM_PROVIDER` (openrouter, openai, ollama, azure)
- [ ] Set `LLM_API_KEY`
- [ ] Set `LLM_MODEL`
- [ ] Set optional variables (default project, repo, etc.)
- [ ] Verify `.env` file is in `.gitignore`

### 3. Security Review
- [ ] Never commit `.env` file to version control
- [ ] Use strong, unique API tokens
- [ ] Restrict token permissions to minimum required
- [ ] Review firewall rules (port 8000)
- [ ] Consider using HTTPS in production (reverse proxy)

## Docker Deployment

### 4. Build
- [ ] Navigate to mcp-server directory: `cd mcp-server`
- [ ] Build image: `make build` or `docker compose build`
- [ ] Verify build succeeded (no errors)
- [ ] Check image size: `docker images | grep mr-pilot-mcp-server`

### 5. Start
- [ ] Start container: `make up` or `docker compose up -d`
- [ ] Wait for startup (10-15 seconds)
- [ ] Check container status: `make status` or `docker compose ps`
- [ ] Verify container is running and healthy

### 6. Verify
- [ ] Test health endpoint: `make health` or `curl http://localhost:8000/health`
- [ ] Check logs: `make logs` or `docker compose logs`
- [ ] Verify no errors in logs
- [ ] Run diagnostic tool: `docker compose exec mcp-server node -e "console.log('OK')"`
- [ ] Check mr-pilot is installed: `docker compose exec mcp-server mr-pilot --version`

## Local Deployment

### 7. Setup (Local)
- [ ] Navigate to mcp-server directory: `cd mcp-server`
- [ ] Copy environment: `cp .env.example .env`
- [ ] Edit `.env` with credentials
- [ ] Verify mr-pilot is installed: `mr-pilot --version` or check parent directory

### 8. Start (Local)
- [ ] Start server: `npm start` or `make dev`
- [ ] Wait for startup message
- [ ] Verify server is listening on port 8000

### 9. Verify (Local)
- [ ] Test health endpoint: `curl http://localhost:8000/health`
- [ ] Run diagnostic tool: `node diagnose.js`
- [ ] Verify all tests pass

## MCP Client Configuration

### 10. Claude Desktop Setup
- [ ] Locate config file:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- [ ] Add MCP server configuration:
  ```json
  {
    "mcpServers": {
      "mr-pilot": {
        "url": "http://127.0.0.1:8000/mcp",
        "transport": "sse"
      }
    }
  }
  ```
- [ ] Save configuration file
- [ ] Restart Claude Desktop

### 11. Test Integration
- [ ] Open Claude Desktop
- [ ] Check for mr-pilot in available tools
- [ ] Test with a simple request: "What tools do you have available?"
- [ ] Test with actual MR/PR review
- [ ] Verify review results are returned
- [ ] Check server logs for successful requests

## Post-Deployment

### 12. Monitoring
- [ ] Set up log monitoring: `make logs` or `docker compose logs -f`
- [ ] Monitor resource usage: `make stats` or `docker stats`
- [ ] Check health endpoint periodically
- [ ] Review logs for errors or warnings

### 13. Backup
- [ ] Backup `.env` file securely (encrypted)
- [ ] Document configuration settings
- [ ] Save Docker image: `docker save mr-pilot-mcp-server > backup.tar`

### 14. Documentation
- [ ] Document deployment date and version
- [ ] Document any custom configuration
- [ ] Document troubleshooting steps taken
- [ ] Share access information with team (if applicable)

## Production Considerations

### 15. Security Hardening
- [ ] Use HTTPS (reverse proxy with nginx/traefik)
- [ ] Implement rate limiting
- [ ] Add authentication (API keys, OAuth)
- [ ] Restrict network access (firewall rules)
- [ ] Use Docker secrets instead of environment variables
- [ ] Regular security updates

### 16. High Availability
- [ ] Set up multiple instances (load balancing)
- [ ] Configure auto-restart: `restart: unless-stopped`
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up backup and disaster recovery

### 17. Performance Optimization
- [ ] Adjust resource limits in compose.yml
- [ ] Monitor memory usage
- [ ] Monitor CPU usage
- [ ] Optimize `MAX_DIFF_CHARS` for your use case
- [ ] Consider caching review results

## Troubleshooting

### 18. Common Issues
- [ ] Server won't start → Check logs, verify port availability
- [ ] Can't connect → Verify URL, check firewall, restart client
- [ ] Environment variables not working → Check .env file, restart container
- [ ] Health check failing → Check logs, verify server is listening
- [ ] mr-pilot not found → Rebuild image with `make rebuild`

### 19. Rollback Plan
- [ ] Document current working version
- [ ] Keep previous Docker image: `docker tag mr-pilot-mcp-server:latest mr-pilot-mcp-server:backup`
- [ ] Know how to rollback: `docker compose down && docker compose up -d`
- [ ] Test rollback procedure

## Maintenance

### 20. Regular Tasks
- [ ] Update mr-pilot: Pull latest code and rebuild
- [ ] Update base image: Change Node.js version in Dockerfile
- [ ] Review and rotate logs
- [ ] Review and update environment variables
- [ ] Test disaster recovery procedure
- [ ] Review security settings

## Sign-off

- [ ] All checklist items completed
- [ ] Server is running and healthy
- [ ] MCP client can connect and use tools
- [ ] Documentation is up to date
- [ ] Team is informed

**Deployed by:** _______________  
**Date:** _______________  
**Version:** _______________  
**Environment:** [ ] Development [ ] Staging [ ] Production  

## Notes

Use this section to document any issues, customizations, or important information:

```
[Add your notes here]
```


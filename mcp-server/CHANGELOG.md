# Changelog

## [1.0.1] - 2025-01-14

### Added
- **Docker Support**: Full Docker and Docker Compose configuration
- **Multi-stage Dockerfile**: Optimized build with mr-pilot installed globally
- **Makefile**: Convenient commands for Docker operations
- **Health Check**: Docker health check configuration
- **Resource Limits**: CPU and memory limits in compose.yml
- **Documentation**: DOCKER.md and QUICKSTART.md guides

### Changed
- **HTTP Status Codes**: Changed from 202 to 200 for JSON-RPC responses (Streamable HTTP compliance)
- **Protocol Version Validation**: Made optional to support more MCP clients
- **Logging**: Enhanced logging with request/response bodies

### Fixed
- **Streamable HTTP Support**: Fixed compatibility with MCP clients using Streamable HTTP transport
- **Connection Timeout**: Resolved 20-second timeout issue with proper HTTP status codes

## [1.0.0] - 2025-01-14

### Initial Release

#### Features
- **SSE/HTTP Transport**: Full MCP specification compliance with Server-Sent Events
- **review_merge_request Tool**: AI-powered code review for GitLab MRs and GitHub PRs
- **Environment Variable Support**: All mr-pilot configuration via environment variables
- **Comprehensive Logging**: Detailed logs with ISO timestamps
- **Development & Production Modes**: Support for both npm run dev and installed binary
- **Session Management**: UUID-based session tracking
- **CORS Support**: Cross-origin resource sharing for web clients

#### Endpoints
- `POST /mcp` - JSON-RPC requests
- `GET /mcp` - SSE stream
- `GET /sse` - Alternative SSE endpoint
- `DELETE /mcp` - Session termination

#### Bug Fixes
- Fixed SSE connection handling to allow connections without initial session ID
- Removed protocol version validation for GET/SSE requests (clients may not send header initially)
- Added automatic session creation for SSE connections
- Fixed deprecated `url.parse()` warning by using WHATWG URL API
- Added `/sse` endpoint for compatibility with different MCP clients
- Return session ID in SSE response headers

#### Documentation
- README.md - Main documentation
- USAGE.md - Usage guide with examples
- IMPLEMENTATION.md - Technical implementation details
- .env.example - Example environment configuration

#### Testing
- test-client.js - Simple test client for validation

### Known Issues
- Sessions are stored in memory (not persistent across restarts)
- No rate limiting implemented
- HTTP only (no HTTPS support yet)

### Future Enhancements
- Persistent session storage (Redis/database)
- Rate limiting
- HTTPS/TLS support
- Authentication (API keys, OAuth)
- Metrics and monitoring
- Additional tools for other mr-pilot features


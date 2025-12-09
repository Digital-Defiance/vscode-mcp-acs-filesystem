# Change Log

All notable changes to the "mcp-acs-filesystem" extension will be documented in this file.

## [0.1.3] - 2024-12-08

### Added

- Comprehensive VS Code extension with full MCP integration
- File Operations panel in activity bar
- Security Boundaries panel showing configuration
- Copilot chat participant (@filesystem)
- Language Model Tools for AI agent integration
- MCP server definition provider
- Command palette commands for all operations:
  - Batch Operations
  - Directory Watching
  - File Search
  - Checksum Computation
  - Disk Usage Analysis
  - Security Boundaries Display
- Keyboard shortcuts:
  - Ctrl+Shift+F Ctrl+Shift+S: Search files
  - Ctrl+Shift+F Ctrl+Shift+B: Batch operations
- Configuration settings for:
  - Security boundaries (workspace root, blocked paths, patterns)
  - Resource limits (file size, batch size, rate limiting)
  - Audit logging
  - UI preferences
- Walkthrough for first-time users
- Integration with shared status bar
- Comprehensive test suite:
  - Unit tests
  - Property-based tests
  - Integration tests

### Security

- Workspace jail enforcement
- 10-layer path validation
- Hardcoded system path blocklist
- Hardcoded sensitive file pattern blocklist
- Rate limiting
- Audit logging

## [0.1.2] - 2024-12-07

### Added

- Initial extension structure
- Basic MCP configuration command

## [0.1.1] - 2024-12-06

### Added

- Project initialization
- Package structure

## [0.1.0] - 2024-12-05

### Added

- Initial release
- Basic extension scaffold

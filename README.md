# MCP ACS Filesystem Manager

Advanced filesystem operations for AI agents with MCP integration and strict security boundaries. Part of the Digital Defiance AI Capabilities Suite.

## Features

### 🚀 Advanced File Operations

- **Batch Operations**: Execute multiple file operations (copy, move, delete) atomically
- **Directory Watching**: Monitor directories for real-time file system changes
- **File Search**: Search by filename, content, or metadata with fast indexing
- **Checksum Computation**: Verify file integrity with MD5, SHA-1, SHA-256, SHA-512
- **Disk Usage Analysis**: Analyze directory sizes and identify large files

### 🔒 Security First

- **Workspace Jail**: All operations confined to workspace root
- **10-Layer Path Validation**: Multiple security checks prevent path traversal
- **Hardcoded Blocklists**: System paths and sensitive files always blocked
- **Rate Limiting**: Prevents abuse with configurable operation limits
- **Audit Logging**: Complete operation tracking for forensics
- **Platform-Specific Security**: Automatic detection and enforcement of OS-specific security boundaries

### 🤖 AI Integration

- **Copilot Chat Participant**: Use `@filesystem` in Copilot chat
- **Language Model Tools**: Direct AI agent access to filesystem operations
- **MCP Protocol**: Standard Model Context Protocol integration
- **Security Boundaries**: AI agents operate within strict, configurable limits
- **Language Server Protocol**: Intelligent code completion, hover information, and diagnostics for filesystem operations

### 🛠️ Developer Experience

- **Type-Safe Settings**: Centralized configuration management with TypeScript types
- **Intelligent Error Handling**: Categorized errors with user-friendly messages and recovery suggestions
- **LSP Integration**: Hover over paths for metadata, get completion suggestions, and see diagnostics
- **Cross-Platform Support**: Automatic platform detection and path normalization for Windows, macOS, and Linux

## Installation

1. Install from VS Code Marketplace
2. Or install via command line:

   ```bash
   code --install-extension DigitalDefiance.mcp-acs-filesystem
   ```

## Quick Start

### Using with Copilot

Ask Copilot to perform file operations:

```
@filesystem batch copy all *.ts files from src to backup
@filesystem search for files containing "TODO"
@filesystem compute sha256 checksum for package.json
@filesystem analyze disk usage in node_modules
@filesystem watch src directory for changes
```

### Using Commands

- **Ctrl+Shift+F Ctrl+Shift+S**: Search files
- **Ctrl+Shift+F Ctrl+Shift+B**: Batch operations
- Or use Command Palette: `MCP Filesystem: ...`

## Configuration

### Security Settings

```json
{
  "mcp-filesystem.security.workspaceRoot": "${workspaceFolder}",
  "mcp-filesystem.security.allowedSubdirectories": [],
  "mcp-filesystem.security.blockedPaths": [
    ".git",
    ".env",
    "node_modules",
    ".ssh"
  ],
  "mcp-filesystem.security.blockedPatterns": [
    "*.key",
    "*.pem",
    "*.env",
    "*secret*",
    "*password*"
  ]
}
```

### Server Settings

```json
{
  "mcp-filesystem.server.autoStart": true,
  "mcp-filesystem.server.timeout": 30000,
  "mcp-filesystem.server.logLevel": "info"
}
```

### Resource Limits

```json
{
  "mcp-filesystem.resources.maxFileSize": 104857600,
  "mcp-filesystem.resources.maxBatchSize": 1073741824,
  "mcp-filesystem.resources.maxOperationsPerMinute": 100
}
```

### UI Settings

```json
{
  "mcp-filesystem.ui.refreshInterval": 5000,
  "mcp-filesystem.ui.showNotifications": true,
  "mcp-filesystem.ui.showSecurityWarnings": true,
  "mcp-filesystem.ui.confirmDangerousOperations": true
}
```

### Operations Settings

```json
{
  "mcp-filesystem.operations.enableBatch": true,
  "mcp-filesystem.operations.enableWatch": true,
  "mcp-filesystem.operations.enableSearch": true,
  "mcp-filesystem.operations.enableChecksum": true
}
```

## Available Operations

### Batch Operations

Execute multiple file operations atomically with automatic rollback on failure:

- Copy multiple files/directories
- Move multiple files/directories
- Delete multiple files/directories

### Directory Watching

Monitor directories for changes with event filtering:

- Recursive watching
- Event type filtering (create, modify, delete, rename)
- Pattern-based filtering

### File Search

Fast file search with multiple modes:

- Filename pattern matching
- Content search (full-text)
- Metadata filtering (size, date, type)
- Indexed search for large codebases

### Checksum Operations

Verify file integrity:

- MD5, SHA-1, SHA-256, SHA-512 algorithms
- Batch checksum computation
- Checksum verification

### Disk Usage Analysis

Analyze storage usage:

- Recursive directory size calculation
- Largest files/directories identification
- File type breakdown
- Available disk space queries

## Security Boundaries

### What AI Agents CANNOT Do

- ❌ Access files outside the workspace root
- ❌ Access system directories (/etc, /sys, C:\Windows, etc.)
- ❌ Access SSH keys, AWS credentials, or other sensitive files
- ❌ Create symlinks pointing outside the workspace
- ❌ Bypass rate limits
- ❌ Disable audit logging
- ❌ Modify the workspace root

### What AI Agents CAN Do (Within Workspace)

- ✅ Read, write, and delete files
- ✅ Create and navigate directories
- ✅ Search for files by name or content
- ✅ Watch directories for changes
- ✅ Compute checksums
- ✅ Create symlinks (within workspace)
- ✅ Batch operations
- ✅ Sync directories

## MCP Server Configuration

The extension automatically configures the MCP server for Copilot integration. To manually add to your workspace:

1. Run command: `MCP Filesystem: Add to Copilot MCP Servers`
2. Or manually add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "mcp-filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@ai-capabilities-suite/mcp-filesystem"]
    }
  }
}
```

## Examples

### Batch Copy Files

```typescript
// Ask Copilot:
@filesystem batch copy all TypeScript files from src to backup

// Or use the MCP tool directly:
{
  "operations": [
    { "type": "copy", "source": "src/file1.ts", "destination": "backup/file1.ts" },
    { "type": "copy", "source": "src/file2.ts", "destination": "backup/file2.ts" }
  ],
  "atomic": true
}
```

### Watch Directory

```typescript
// Ask Copilot:
@filesystem watch src directory recursively for TypeScript files

// Or use the MCP tool:
{
  "path": "src",
  "recursive": true,
  "filters": ["*.ts", "*.tsx"]
}
```

### Search Files

```typescript
// Ask Copilot:
@filesystem search for files containing "TODO" in src directory

// Or use the MCP tool:
{
  "query": "TODO",
  "searchType": "content",
  "fileTypes": [".ts", ".tsx", ".js"]
}
```

## Language Server Features

The extension includes a Language Server Protocol (LSP) implementation that provides intelligent code assistance:

### Hover Information

Hover over filesystem paths in your code to see:

- File metadata (size, permissions, modification time)
- Security boundary information
- Available MCP filesystem tools

### Code Completion

Get intelligent completion suggestions for:

- MCP filesystem tool names
- Common filesystem paths
- Operation parameters

### Diagnostics

Real-time warnings and errors for:

- Paths outside workspace root
- Blocked paths and patterns
- Dangerous filesystem operations
- Symlink operations requiring validation

### Code Actions

Quick fixes for common issues:

- Convert to workspace-relative paths
- Remove blocked path references
- Convert sync operations to async
- Open security settings

## Troubleshooting

### Server Not Starting

1. Check output panel: `View > Output > MCP ACS Filesystem Manager`
2. Verify Node.js is installed: `node --version`
3. Check server path in settings
4. Try restarting VS Code
5. Review server logs for detailed error information

### Permission Errors

1. Verify workspace root is accessible
2. Check blocked paths configuration
3. Review audit log for security violations
4. Ensure files are within workspace boundaries
5. Check platform-specific security boundaries

### Performance Issues

1. Reduce `maxOperationsPerMinute` for rate limiting
2. Use indexed search for large codebases
3. Limit directory watching depth
4. Check disk space and file sizes
5. Adjust `ui.refreshInterval` to reduce UI updates

### Configuration Errors

1. Open settings: `Ctrl+,` (or `Cmd+,` on macOS)
2. Search for "mcp-filesystem"
3. Verify all settings have valid values
4. Check for validation errors in the output panel
5. Reset to defaults if needed

### LSP Not Working

1. Check that the language server is running in the output panel
2. Verify activation events are triggered (open a TypeScript/JavaScript file)
3. Try reloading the window: `Developer: Reload Window`
4. Check for conflicting extensions
5. Review LSP logs in the output panel

### Error Messages

The extension provides categorized error messages:

- **User Errors**: Invalid input or file not found - check your paths and permissions
- **System Errors**: Disk space or memory issues - check system resources
- **Network Errors**: MCP server connection issues - restart the server
- **Security Errors**: Blocked paths or boundary violations - review security settings
- **Configuration Errors**: Invalid settings - check configuration values

Each error includes recovery suggestions to help you resolve the issue quickly.

## Support

- **Issues**: [GitHub Issues](https://github.com/digital-defiance/ai-capabilities-suite/issues)
- **Documentation**: [GitHub Repository](https://github.com/digital-defiance/ai-capabilities-suite)
- **Email**: <info@digitaldefiance.org>

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Part of AI Capabilities Suite

This extension is part of the Digital Defiance AI Capabilities Suite, which includes:

- **MCP ACS Process Manager**: Process management with security boundaries
- **MCP ACS Screenshot**: Cross-platform screenshot capture
- **MCP ACS Debugger**: Advanced debugging capabilities
- **MCP ACS Filesystem Manager**: Advanced file operations (this extension)

Visit [Digital Defiance](https://digitaldefiance.org) for more information.

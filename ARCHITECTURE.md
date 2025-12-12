# Architecture Documentation

## Overview

The MCP ACS Filesystem Manager is a VS Code extension that provides advanced filesystem operations for AI agents with strict security boundaries. The extension follows a modular architecture with clear separation of concerns and comprehensive error handling.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code Extension Host                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Extension  │  │   Settings   │  │    Error     │      │
│  │  (Main Entry)│──│   Manager    │──│   Handler    │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                     │
│         ├──────────┬──────────────┬──────────────┐          │
│         │          │              │              │          │
│  ┌──────▼───┐ ┌───▼────┐  ┌──────▼────┐  ┌──────▼────┐    │
│  │ Language │ │  MCP   │  │Operations │  │ Security  │    │
│  │  Server  │ │ Client │  │   Tree    │  │   Tree    │    │
│  └──────────┘ └────┬───┘  └───────────┘  └───────────┘    │
│                    │                                         │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     │ MCP Protocol (stdio)
                     │
            ┌────────▼────────┐
            │  MCP Filesystem │
            │     Server      │
            └─────────────────┘
```

## Core Components

### 1. Extension (extension.ts)

**Purpose**: Main entry point and orchestrator for the extension.

**Responsibilities**:

- Initialize all components during activation
- Manage component lifecycle
- Register commands and providers
- Coordinate between components
- Handle deactivation and cleanup

**Key Methods**:

- `activate()`: Initialize extension components
- `deactivate()`: Clean up resources
- `registerCommands()`: Register VS Code commands
- `setupProviders()`: Initialize tree providers

**Dependencies**:

- Settings Manager
- Error Handler
- MCP Client
- Language Server
- Tree Providers
- Platform Detection

### 2. Settings Manager (settingsManager.ts)

**Purpose**: Centralized, type-safe configuration management.

**Responsibilities**:

- Load settings from VS Code configuration
- Provide type-safe access to settings
- Validate setting values
- Emit change events when settings update
- Apply default values for unconfigured settings

**Key Interfaces**:

```typescript
interface FilesystemSettings {
  server: ServerSettings;
  security: SecuritySettings;
  operations: OperationsSettings;
  ui: UISettings;
}
```

**Key Methods**:

- `getSettings()`: Get current settings
- `validateSettings()`: Validate setting values
- `updateSettings()`: Update settings with validation
- `reloadSettings()`: Reload from VS Code configuration

**Events**:

- `onDidChange`: Fired when settings change

### 3. Error Handler (errorHandling.ts)

**Purpose**: Centralized error handling with categorization and user-friendly messages.

**Responsibilities**:

- Categorize errors by type
- Generate user-friendly error messages
- Provide recovery suggestions
- Log detailed error information
- Aggregate similar errors to prevent spam

**Error Categories**:

- `USER_ERROR`: Invalid input, file not found
- `SYSTEM_ERROR`: Disk space, memory issues
- `NETWORK_ERROR`: MCP server connection issues
- `SECURITY_ERROR`: Blocked paths, boundary violations
- `CONFIGURATION_ERROR`: Invalid settings

**Key Methods**:

- `handleError()`: Main error handling entry point
- `categorizeError()`: Determine error category
- `getUserFriendlyMessage()`: Generate readable message
- `getRecoverySuggestions()`: Provide actionable suggestions
- `logError()`: Log detailed error information

**Error Aggregation**:

- Tracks errors within a 5-second window
- Aggregates similar errors to prevent notification spam
- Shows count when displaying aggregated errors

### 4. Language Server (languageServer.ts)

**Purpose**: Provide LSP capabilities for Copilot integration and developer assistance.

**Responsibilities**:

- Provide hover information for filesystem paths
- Suggest completions for filesystem operations
- Generate diagnostics for invalid operations
- Offer code actions for quick fixes
- Provide context to Copilot

**Capabilities**:

#### Hover Provider

- Display file metadata (size, permissions, modified time)
- Show security boundary information
- Explain filesystem operations

#### Completion Provider

- Suggest MCP filesystem tool names
- Suggest common filesystem paths
- Provide parameter hints

#### Diagnostics Provider

- Warn about paths outside workspace root
- Error on blocked paths and patterns
- Warn about sync operations
- Info on symlink operations

#### Code Actions Provider

- Convert to workspace-relative paths
- Remove blocked path references
- Convert sync to async operations
- Open security settings

**Configuration Reactivity**:

- Listens for configuration changes
- Updates capabilities dynamically
- Revalidates all open documents

### 5. MCP Client (mcpClient.ts)

**Purpose**: Communicate with the MCP filesystem server.

**Responsibilities**:

- Start and stop MCP server
- Send tool invocation requests
- Handle server responses
- Manage server lifecycle
- Report server status

**Supported Tools**:

- `batchOperations`: Execute multiple operations atomically
- `watchDirectory`: Monitor directory for changes
- `getWatchEvents`: Retrieve accumulated watch events
- `stopWatch`: Stop a watch session
- `searchFiles`: Search by name, content, or metadata
- `buildIndex`: Build search index
- `createSymlink`: Create symbolic links
- `computeChecksum`: Calculate file checksums
- `verifyChecksum`: Verify file integrity
- `analyzeDiskUsage`: Analyze disk usage
- `copyDirectory`: Copy directory recursively
- `syncDirectory`: Sync directories

**Error Handling**:

- Uses Error Handler for categorization
- Provides recovery suggestions
- Continues operating after errors

### 6. Platform Detection (platformDetection.ts)

**Purpose**: Handle platform-specific logic for filesystem operations.

**Responsibilities**:

- Detect current platform (Windows, macOS, Linux)
- Normalize paths for platform
- Provide platform-specific command syntax
- Enforce platform-specific security boundaries
- Format paths for display

**Platform-Specific Features**:

#### Path Normalization

- Convert path separators to platform format
- Resolve relative paths
- Handle home directory expansion

#### Security Boundaries

- Windows: Block C:\Windows, Program Files, etc.
- macOS: Block /System, /Library, /private, etc.
- Linux: Block /sys, /proc, /dev, etc.

#### Path Formatting

- Display paths with platform conventions
- Replace home directory with ~
- Uppercase drive letters on Windows

**Key Methods**:

- `getPlatformInfo()`: Get platform details
- `normalizePath()`: Normalize path for platform
- `validatePathSecurity()`: Check against security boundaries
- `formatPathForDisplay()`: Format for user display
- `getCommandSyntax()`: Get platform-specific command syntax

### 7. Operations Tree Provider (operationsTreeProvider.ts)

**Purpose**: Display filesystem operations in the sidebar.

**Responsibilities**:

- Show recent operations
- Display active watch sessions
- Provide operation details
- Allow stopping watch sessions
- Refresh on demand

**Tree Structure**:

```
File Operations
├── Recent Operations
│   ├── Batch Operation (timestamp)
│   ├── Search (timestamp)
│   └── Checksum (timestamp)
└── Active Watch Sessions
    ├── Watch: src/ (session-id)
    └── Watch: dist/ (session-id)
```

### 8. Security Tree Provider (securityTreeProvider.ts)

**Purpose**: Display security configuration in the sidebar.

**Responsibilities**:

- Show workspace root
- Display blocked paths
- Display blocked patterns
- Show resource limits
- Provide configuration links

**Tree Structure**:

```
Security Boundaries
├── Workspace Root: /path/to/workspace
├── Blocked Paths
│   ├── .git
│   ├── .env
│   └── node_modules
├── Blocked Patterns
│   ├── *.key
│   ├── *.pem
│   └── *.env
└── Resource Limits
    ├── Max File Size: 100 MB
    ├── Max Batch Size: 1 GB
    └── Max Operations/Min: 100
```

## Data Flow

### 1. Command Execution Flow

```
User Command
    │
    ▼
Extension Command Handler
    │
    ├──► Settings Manager (get settings)
    │
    ├──► MCP Client (invoke tool)
    │       │
    │       ▼
    │   MCP Server (execute operation)
    │       │
    │       ▼
    │   Response
    │
    ├──► Error Handler (if error)
    │
    └──► Tree Provider (update UI)
```

### 2. Settings Change Flow

```
VS Code Configuration Change
    │
    ▼
Settings Manager
    │
    ├──► Validate Settings
    │
    ├──► Update Internal State
    │
    ├──► Emit Change Event
    │
    └──► Subscribers
         │
         ├──► MCP Client (update server config)
         ├──► Language Server (update capabilities)
         └──► Tree Providers (refresh)
```

### 3. Error Handling Flow

```
Error Occurs
    │
    ▼
Error Handler
    │
    ├──► Categorize Error
    │
    ├──► Check Aggregation
    │       │
    │       ├──► Within Window: Aggregate
    │       └──► Outside Window: Show
    │
    ├──► Generate User Message
    │
    ├──► Get Recovery Suggestions
    │
    ├──► Log to Output Channel
    │
    └──► Show to User
```

### 4. LSP Request Flow

```
User Action (hover, completion, etc.)
    │
    ▼
Language Server
    │
    ├──► Get Document
    │
    ├──► Analyze Context
    │
    ├──► Check Configuration
    │
    ├──► Generate Response
    │       │
    │       ├──► Hover: File metadata
    │       ├──► Completion: Tool suggestions
    │       ├──► Diagnostics: Validation errors
    │       └──► Code Actions: Quick fixes
    │
    └──► Return to VS Code
```

## Design Decisions

### 1. Centralized Settings Management

**Decision**: Use a dedicated Settings Manager class instead of direct VS Code configuration access.

**Rationale**:

- Type safety with TypeScript interfaces
- Validation before applying settings
- Change event propagation to all components
- Default value management
- Single source of truth

**Trade-offs**:

- Additional abstraction layer
- Slightly more complex initialization
- Benefits outweigh costs for maintainability

### 2. Categorized Error Handling

**Decision**: Categorize all errors into five types (user, system, network, security, configuration).

**Rationale**:

- Different error types require different handling
- User-friendly messages for user errors
- Technical details for system errors
- Security explanations for security errors
- Consistent error experience

**Trade-offs**:

- Requires error categorization logic
- May not fit all error types perfectly
- Provides better user experience overall

### 3. Language Server Integration

**Decision**: Implement a full Language Server Protocol server for filesystem operations.

**Rationale**:

- Enables Copilot integration
- Provides intelligent code assistance
- Real-time validation and diagnostics
- Industry-standard protocol
- Future extensibility

**Trade-offs**:

- Additional complexity
- Separate process management
- Worth it for AI integration benefits

### 4. Platform Detection

**Decision**: Implement platform-specific logic for paths and security.

**Rationale**:

- Different platforms have different path formats
- Platform-specific security boundaries
- Better user experience with native conventions
- Prevents cross-platform issues

**Trade-offs**:

- More code to maintain
- Platform-specific testing required
- Essential for cross-platform support

### 5. Error Aggregation

**Decision**: Aggregate similar errors within a 5-second window.

**Rationale**:

- Prevents notification spam
- Better user experience
- Still shows all errors in logs
- Configurable window size

**Trade-offs**:

- May delay error notifications
- Adds complexity to error handling
- Significantly improves UX

### 6. Modular Architecture

**Decision**: Separate concerns into distinct, focused components.

**Rationale**:

- Easier to test individual components
- Clear responsibilities
- Better maintainability
- Enables independent evolution
- Follows SOLID principles

**Trade-offs**:

- More files to manage
- Requires coordination between components
- Benefits scale with project size

## Testing Strategy

### Unit Tests

- Test individual components in isolation
- Mock all dependencies
- Target 80%+ code coverage
- Use Mocha with Sinon for mocking

### Integration Tests

- Test component interactions
- Verify complete workflows
- Test settings propagation
- Test error handling paths

### Property-Based Tests

- Use fast-check library
- Generate random valid inputs
- Run 100+ iterations per property
- Test invariants and properties

### End-to-End Tests

- Test in real VS Code environment
- Simulate user interactions
- Verify UI updates
- Test complete workflows

## Performance Considerations

### Activation Time

- Target: < 1 second
- Lazy load components where possible
- Defer non-critical initialization
- Use async initialization

### LSP Response Time

- Target: < 100ms for hover/completion
- Cache file metadata
- Use incremental updates
- Debounce requests

### Settings Application

- Target: < 50ms
- Batch updates
- Use change events
- Avoid unnecessary refreshes

### Memory Usage

- Target: < 50MB baseline
- Dispose resources properly
- Clear caches periodically
- Monitor for leaks

## Security Architecture

### Defense in Depth

1. **Workspace Jail**: All operations confined to workspace root
2. **Path Validation**: 10-layer validation prevents traversal
3. **Blocked Paths**: Hardcoded system path blocklist
4. **Blocked Patterns**: Sensitive file pattern blocklist
5. **Platform Security**: OS-specific security boundaries
6. **Rate Limiting**: Prevents abuse
7. **Audit Logging**: Complete operation tracking
8. **LSP Validation**: Real-time code validation
9. **Configuration Validation**: Settings validation
10. **Error Sanitization**: No sensitive data in errors

### Security Boundaries

#### Workspace Root

- Primary security boundary
- All operations must be within workspace
- Configurable per workspace
- Validated on every operation

#### Blocked Paths

- System directories always blocked
- Sensitive directories (.ssh, .gnupg)
- Configuration files (.env, \*.key)
- User-configurable additions

#### Blocked Patterns

- Wildcard pattern matching
- Sensitive file extensions
- Credential patterns
- User-configurable additions

## Extension Points

### Adding New Operations

1. Add tool definition to `package.json`
2. Implement handler in `mcpClient.ts`
3. Add command registration in `extension.ts`
4. Update tree providers if needed
5. Add LSP support if applicable
6. Add tests

### Adding New Settings

1. Define interface in `settingsManager.ts`
2. Add to `FilesystemSettings` interface
3. Add validation logic
4. Add to `package.json` configuration
5. Update documentation
6. Add tests

### Adding New Error Categories

1. Add to `ErrorCategory` enum
2. Implement categorization logic
3. Add user-friendly message generation
4. Add recovery suggestions
5. Update documentation
6. Add tests

## Future Enhancements

### Planned Features

- Remote filesystem support
- Cloud storage integration
- Advanced search with regex
- File diff and merge tools
- Backup and restore operations
- File encryption support

### Performance Improvements

- Incremental indexing
- Parallel operations
- Caching strategies
- Background processing

### Security Enhancements

- Sandboxed execution
- Permission system
- Audit log analysis
- Anomaly detection

## Maintenance Guidelines

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier
- Document all public APIs
- Write self-documenting code

### Testing

- Write tests for all new features
- Maintain 80%+ coverage
- Test error paths
- Test platform-specific code

### Documentation

- Update README for user-facing changes
- Update ARCHITECTURE for design changes
- Update CHANGELOG for all changes
- Keep JSDoc comments current

### Versioning

- Follow semantic versioning
- Document breaking changes
- Provide migration guides
- Test upgrade paths

## Troubleshooting

### Common Issues

#### Extension Not Activating

- Check activation events in package.json
- Verify no errors in output panel
- Check for conflicting extensions
- Try reloading window

#### LSP Not Working

- Verify language server is running
- Check output panel for errors
- Verify activation events triggered
- Check for port conflicts

#### Settings Not Applying

- Verify settings validation passes
- Check for configuration errors
- Reload settings manager
- Check change event propagation

#### Performance Issues

- Profile activation time
- Check for memory leaks
- Monitor LSP response times
- Review refresh intervals

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

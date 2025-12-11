# Implementation Spec: Complete vscode-mcp-acs-filesystem Extension

## Overview

This spec outlines the missing components and tests needed to bring the vscode-mcp-acs-filesystem extension to feature parity with vscode-mcp-acs-process, ensuring comprehensive functionality, testing, and maintainability.

## Current State Analysis

### Existing Components

- ✅ `extension.ts` - Main extension entry point
- ✅ `mcpClient.ts` - MCP server client
- ✅ `operationsTreeProvider.ts` - Operations tree view
- ✅ `securityTreeProvider.ts` - Security tree view

### Existing Tests

- ✅ `extension.test.ts` - Basic extension tests
- ✅ `extension.property.test.ts` - Property-based tests
- ✅ `integration.test.ts` - Integration tests
- ✅ `e2e.test.ts` - End-to-end tests
- ✅ `mcpClient.test.ts` - MCP client tests
- ✅ `operationsTreeProvider.test.ts` - Operations tree tests
- ✅ `securityTreeProvider.test.ts` - Security tree tests
- ✅ `settings.unit.test.ts` - Settings tests
- ✅ `validation.unit.test.ts` - Validation tests

### Missing Components (Critical)

- ❌ `languageServer.ts` - LSP integration for Copilot
- ❌ `settingsManager.ts` - Centralized settings management
- ❌ `errorHandling.ts` - Centralized error handling
- ❌ `platformDetection.ts` - Platform-specific logic

### Missing Tests

- ❌ `lsp.test.ts` - Language server unit tests
- ❌ `lsp-e2e.test.ts` - Language server E2E tests
- ❌ `settingsManager.unit.test.ts` - Settings manager unit tests
- ❌ `settingsManager.property.test.ts` - Settings manager property tests
- ❌ `settingsFlow.integration.test.ts` - Settings flow integration tests
- ❌ `statusBar.test.ts` - Status bar integration tests

## Requirements

### R1: Language Server Protocol (LSP) Integration

**Priority:** P0 (Critical)

**Description:** Implement LSP integration to enable Copilot and other AI assistants to understand filesystem operations context.

**Acceptance Criteria:**

- LSP server starts with extension activation
- Provides filesystem operation context to Copilot
- Supports all 12 filesystem tools
- Handles configuration changes dynamically
- Provides diagnostics for invalid operations
- Supports hover information for filesystem paths
- Provides completion suggestions for paths

**Dependencies:**

- vscode-languageclient package
- vscode-languageserver package

**Reference Implementation:** `packages/vscode-mcp-acs-process/src/languageServer.ts`

### R2: Settings Manager

**Priority:** P0 (Critical)

**Description:** Centralized settings management with validation, change detection, and type safety.

**Acceptance Criteria:**

- Type-safe settings access
- Settings validation on change
- Change event notifications
- Default value handling
- Settings migration support
- Configuration schema validation

**Dependencies:**

- VS Code workspace configuration API

**Reference Implementation:** `packages/vscode-mcp-acs-process/src/settingsManager.ts`

### R3: Error Handling

**Priority:** P1 (High)

**Description:** Centralized error handling with categorization, user-friendly messages, and logging.

**Acceptance Criteria:**

- Error categorization (user, system, network, etc.)
- User-friendly error messages
- Detailed logging for debugging
- Error recovery suggestions
- Telemetry integration (optional)

**Dependencies:**

- VS Code window API
- Output channel

**Reference Implementation:** `packages/vscode-mcp-acs-process/src/errorHandling.ts`

### R4: Platform Detection

**Priority:** P2 (Medium)

**Description:** Platform-specific logic for Windows, macOS, and Linux.

**Acceptance Criteria:**

- Detect current platform
- Provide platform-specific paths
- Handle platform-specific commands
- Support platform-specific security boundaries

**Dependencies:**

- Node.js os module

**Reference Implementation:** `packages/vscode-mcp-acs-process/src/platformDetection.ts`

### R5: Comprehensive Test Coverage

**Priority:** P1 (High)

**Description:** Achieve 80%+ test coverage with unit, integration, property-based, and E2E tests.

**Acceptance Criteria:**

- All source files have dedicated unit tests
- Integration tests cover all workflows
- Property-based tests for complex logic
- E2E tests for user scenarios
- LSP integration tests
- Settings flow tests
- Status bar integration tests

**Dependencies:**

- Mocha test framework
- fast-check for property-based testing
- VS Code test utilities

## Design

### D1: Language Server Architecture

```typescript
// languageServer.ts

export class FilesystemLanguageServer {
  private client: LanguageClient | undefined;
  private server: LanguageServer | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private mcpClient: MCPFilesystemClient,
    private outputChannel: vscode.LogOutputChannel
  ) {}

  async start(): Promise<void> {
    // Initialize language server
    // Register capabilities
    // Connect to MCP client
  }

  async stop(): Promise<void> {
    // Cleanup resources
  }

  private registerCapabilities(): void {
    // Hover provider
    // Completion provider
    // Diagnostics provider
    // Code actions provider
  }

  private async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    // Provide filesystem path information
  }

  private async provideCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    // Provide path completions
  }

  private async provideDiagnostics(
    document: vscode.TextDocument
  ): Promise<vscode.Diagnostic[]> {
    // Validate filesystem operations
  }
}
```

### D2: Settings Manager Architecture

```typescript
// settingsManager.ts

export interface FilesystemSettings {
  server: {
    autoStart: boolean;
    serverPath: string;
    timeout: number;
  };
  security: {
    workspaceRoot: string;
    allowedSubdirectories: string[];
    blockedPaths: string[];
    blockedPatterns: string[];
    maxFileSize: number;
    maxBatchSize: number;
  };
  operations: {
    enableBatch: boolean;
    enableWatch: boolean;
    enableSearch: boolean;
    enableChecksum: boolean;
  };
  ui: {
    refreshInterval: number;
    showNotifications: boolean;
  };
}

export class SettingsManager {
  private settings: FilesystemSettings;
  private changeEmitter: vscode.EventEmitter<FilesystemSettings>;

  constructor() {
    this.settings = this.loadSettings();
    this.changeEmitter = new vscode.EventEmitter();
  }

  get onDidChange(): vscode.Event<FilesystemSettings> {
    return this.changeEmitter.event;
  }

  getSettings(): FilesystemSettings {
    return { ...this.settings };
  }

  getSetting<K extends keyof FilesystemSettings>(
    key: K
  ): FilesystemSettings[K] {
    return this.settings[key];
  }

  async updateSetting<K extends keyof FilesystemSettings>(
    key: K,
    value: FilesystemSettings[K]
  ): Promise<void> {
    // Validate and update setting
    // Emit change event
  }

  private loadSettings(): FilesystemSettings {
    // Load from VS Code configuration
  }

  private validateSettings(settings: FilesystemSettings): void {
    // Validate settings structure and values
  }
}
```

### D3: Error Handling Architecture

```typescript
// errorHandling.ts

export enum ErrorCategory {
  USER_ERROR = "user",
  SYSTEM_ERROR = "system",
  NETWORK_ERROR = "network",
  SECURITY_ERROR = "security",
  CONFIGURATION_ERROR = "configuration",
}

export interface FilesystemError {
  category: ErrorCategory;
  message: string;
  details?: string;
  suggestion?: string;
  originalError?: Error;
}

export class ErrorHandler {
  constructor(private outputChannel: vscode.LogOutputChannel) {}

  handleError(error: FilesystemError): void {
    // Log error
    // Show user-friendly message
    // Provide recovery suggestions
  }

  categorizeError(error: Error): ErrorCategory {
    // Categorize error based on type and message
  }

  getUserFriendlyMessage(error: FilesystemError): string {
    // Generate user-friendly error message
  }

  getRecoverySuggestion(error: FilesystemError): string | undefined {
    // Provide recovery suggestions
  }
}
```

## Implementation Tasks

### Phase 1: Core Components (P0)

#### Task 1.1: Implement Language Server

- **Estimate:** 8-12 hours
- **Files:**
  - Create `src/languageServer.ts`
  - Update `src/extension.ts` to initialize LSP
- **Tests:**
  - Create `src/test/suite/lsp.test.ts` (unit tests)
  - Create `src/test/suite/lsp-e2e.test.ts` (E2E tests)
- **Acceptance:**
  - LSP starts with extension
  - Provides hover information
  - Provides completions
  - Provides diagnostics
  - All tests pass

#### Task 1.2: Implement Settings Manager

- **Estimate:** 6-8 hours
- **Files:**
  - Create `src/settingsManager.ts`
  - Update `src/extension.ts` to use settings manager
  - Update `src/mcpClient.ts` to use settings manager
- **Tests:**
  - Create `src/test/suite/settingsManager.unit.test.ts`
  - Create `src/test/suite/settingsManager.property.test.ts`
  - Create `src/test/suite/settingsFlow.integration.test.ts`
- **Acceptance:**
  - Settings are type-safe
  - Settings validation works
  - Change events fire correctly
  - All tests pass

### Phase 2: Supporting Components (P1)

#### Task 2.1: Implement Error Handling

- **Estimate:** 4-6 hours
- **Files:**
  - Create `src/errorHandling.ts`
  - Update all source files to use error handler
- **Tests:**
  - Add error handling tests to existing test files
- **Acceptance:**
  - Errors are categorized correctly
  - User-friendly messages are shown
  - Recovery suggestions are provided
  - All tests pass

#### Task 2.2: Implement Platform Detection

- **Estimate:** 2-4 hours
- **Files:**
  - Create `src/platformDetection.ts`
  - Update relevant source files to use platform detection
- **Tests:**
  - Add platform detection tests to existing test files
- **Acceptance:**
  - Platform is detected correctly
  - Platform-specific logic works
  - All tests pass

### Phase 3: Enhanced Testing (P1)

#### Task 3.1: Enhance Existing Tests

- **Estimate:** 6-8 hours
- **Files:**
  - Update `src/test/suite/mcpClient.test.ts`
  - Update `src/test/suite/operationsTreeProvider.test.ts`
  - Update `src/test/suite/securityTreeProvider.test.ts`
  - Update `src/test/suite/integration.test.ts`
  - Update `src/test/suite/e2e.test.ts`
- **Acceptance:**
  - All existing tests are comprehensive
  - Edge cases are covered
  - Error scenarios are tested
  - All tests pass

#### Task 3.2: Add Missing Tests

- **Estimate:** 4-6 hours
- **Files:**
  - Create `src/test/suite/statusBar.test.ts`
  - Enhance `src/test/suite/validation.unit.test.ts`
  - Enhance `src/test/suite/extension.property.test.ts`
- **Acceptance:**
  - Status bar integration is tested
  - Validation logic is comprehensive
  - Property-based tests cover complex scenarios
  - All tests pass

### Phase 4: Documentation and Polish (P2)

#### Task 4.1: Update Documentation

- **Estimate:** 2-4 hours
- **Files:**
  - Update `README.md`
  - Update `CHANGELOG.md`
  - Create `ARCHITECTURE.md`
- **Acceptance:**
  - Documentation is up-to-date
  - Architecture is documented
  - Examples are provided

#### Task 4.2: Code Quality

- **Estimate:** 2-4 hours
- **Tasks:**
  - Run linter and fix issues
  - Run formatter
  - Review and refactor code
  - Add missing JSDoc comments
- **Acceptance:**
  - No linter errors
  - Code is formatted consistently
  - All public APIs have JSDoc comments

## Testing Strategy

### Unit Tests

- Test individual functions and classes in isolation
- Use mocks for dependencies
- Cover edge cases and error scenarios
- Target: 80%+ coverage per file

### Integration Tests

- Test component interactions
- Use real VS Code APIs where possible
- Test configuration changes
- Test MCP client integration
- Target: All workflows covered

### Property-Based Tests

- Test invariants and properties
- Use fast-check for property generation
- Focus on complex logic (validation, security)
- Target: All complex logic covered

### E2E Tests

- Test complete user workflows
- Test UI interactions
- Test command palette integration
- Test settings UI integration
- Target: All user scenarios covered

### LSP Tests

- Test language server capabilities
- Test hover, completion, diagnostics
- Test configuration changes
- Test error handling
- Target: All LSP features covered

## Success Criteria

### Functional Requirements

- ✅ LSP integration works with Copilot
- ✅ Settings manager provides type-safe access
- ✅ Error handling provides user-friendly messages
- ✅ Platform detection works on all platforms
- ✅ All existing functionality continues to work

### Quality Requirements

- ✅ 80%+ test coverage
- ✅ All tests pass
- ✅ No linter errors
- ✅ Code is well-documented
- ✅ Architecture is documented

### Performance Requirements

- ✅ Extension activates in < 1 second
- ✅ LSP responds in < 100ms
- ✅ Settings changes apply immediately
- ✅ No memory leaks

## Risks and Mitigations

### Risk 1: LSP Complexity

- **Impact:** High
- **Probability:** Medium
- **Mitigation:** Use reference implementation from process extension, start with basic features

### Risk 2: Breaking Changes

- **Impact:** High
- **Probability:** Low
- **Mitigation:** Comprehensive testing, gradual rollout, version bump

### Risk 3: Test Maintenance

- **Impact:** Medium
- **Probability:** Medium
- **Mitigation:** Keep tests simple, use shared test utilities, document test patterns

### Risk 4: Time Overrun

- **Impact:** Medium
- **Probability:** Medium
- **Mitigation:** Prioritize P0 tasks, defer P2 tasks if needed, regular progress reviews

## Timeline

### Week 1: Core Components

- Day 1-3: Implement Language Server (Task 1.1)
- Day 4-5: Implement Settings Manager (Task 1.2)

### Week 2: Supporting Components and Testing

- Day 1-2: Implement Error Handling (Task 2.1)
- Day 3: Implement Platform Detection (Task 2.2)
- Day 4-5: Enhance Existing Tests (Task 3.1)

### Week 3: Final Testing and Polish

- Day 1-2: Add Missing Tests (Task 3.2)
- Day 3: Update Documentation (Task 4.1)
- Day 4: Code Quality (Task 4.2)
- Day 5: Final review and release

**Total Estimate:** 34-52 hours (3 weeks)

## Dependencies

### External Dependencies

- vscode-languageclient: ^9.0.0
- vscode-languageserver: ^9.0.0
- fast-check: ^3.0.0 (already installed)

### Internal Dependencies

- @ai-capabilities-suite/vscode-shared-status-bar (already used)
- VS Code Extension API

## Deliverables

1. **Source Code**

   - `src/languageServer.ts`
   - `src/settingsManager.ts`
   - `src/errorHandling.ts`
   - `src/platformDetection.ts`
   - Updated `src/extension.ts`
   - Updated `src/mcpClient.ts`

2. **Tests**

   - `src/test/suite/lsp.test.ts`
   - `src/test/suite/lsp-e2e.test.ts`
   - `src/test/suite/settingsManager.unit.test.ts`
   - `src/test/suite/settingsManager.property.test.ts`
   - `src/test/suite/settingsFlow.integration.test.ts`
   - `src/test/suite/statusBar.test.ts`
   - Enhanced existing tests

3. **Documentation**

   - Updated `README.md`
   - Updated `CHANGELOG.md`
   - New `ARCHITECTURE.md`

4. **Package Updates**
   - Updated `package.json` with new dependencies
   - Updated version number

## Approval

This spec requires approval from:

- [ ] Technical Lead
- [ ] Product Owner
- [ ] QA Lead

## Revision History

| Version | Date       | Author | Changes      |
| ------- | ---------- | ------ | ------------ |
| 1.0     | 2025-12-09 | Kiro   | Initial spec |

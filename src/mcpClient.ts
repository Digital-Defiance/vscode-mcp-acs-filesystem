import * as vscode from "vscode";
import { SettingsManager } from "./settingsManager";
import { ErrorHandler, ErrorCategory } from "./errorHandling";

export interface FileOperation {
  id: string;
  type: "batch" | "watch" | "search" | "checksum" | "disk_usage";
  status: "pending" | "running" | "completed" | "failed";
  timestamp: Date;
  details: any;
  result?: any;
  error?: string;
}

export interface WatchSession {
  id: string;
  path: string;
  recursive: boolean;
  filters: string[];
  eventCount: number;
  startTime: Date;
}

/**
 * Simplified filesystem client that tracks operations locally
 * The actual MCP server communication happens through VS Code's language model tools
 */
export class MCPFilesystemClient {
  private operations: Map<string, FileOperation> = new Map();
  private watchSessions: Map<string, WatchSession> = new Map();
  private outputChannel: vscode.LogOutputChannel;
  private settingsManager?: SettingsManager;
  private errorHandler?: ErrorHandler;
  private settingsSubscription?: vscode.Disposable;

  constructor(
    outputChannel: vscode.LogOutputChannel,
    settingsManager?: SettingsManager,
    errorHandler?: ErrorHandler
  ) {
    this.outputChannel = outputChannel;
    this.settingsManager = settingsManager;
    this.errorHandler = errorHandler;

    // Subscribe to settings changes
    if (this.settingsManager) {
      this.settingsSubscription = this.settingsManager.onDidChange(
        (settings) => {
          this.onSettingsChanged(settings);
        }
      );
    }
  }

  async start(): Promise<void> {
    this.outputChannel.appendLine("MCP Filesystem client initialized");

    // Log current settings
    if (this.settingsManager) {
      const settings = this.settingsManager.getSettings();
      this.outputChannel.appendLine(
        `Server timeout: ${settings.server.timeout}ms`
      );
      this.outputChannel.appendLine(
        `Max file size: ${settings.security.maxFileSize} bytes`
      );
      this.outputChannel.appendLine(
        `Max batch size: ${settings.security.maxBatchSize} bytes`
      );
    }
  }

  stop(): void {
    this.operations.clear();
    this.watchSessions.clear();

    // Unsubscribe from settings changes
    if (this.settingsSubscription) {
      this.settingsSubscription.dispose();
      this.settingsSubscription = undefined;
    }

    this.outputChannel.appendLine("MCP Filesystem client stopped");
  }

  isRunning(): boolean {
    return true;
  }

  /**
   * Handle settings changes
   */
  private onSettingsChanged(settings: any): void {
    this.outputChannel.appendLine("MCP client settings updated");

    // Log relevant setting changes
    this.outputChannel.appendLine(
      `Server timeout: ${settings.server.timeout}ms`
    );
    this.outputChannel.appendLine(
      `Max operations per minute: ${settings.security.maxOperationsPerMinute}`
    );

    // Note: In a real implementation, we might need to reconnect to the server
    // or update rate limiters based on new settings
  }

  /**
   * Record a batch operation
   */
  recordBatchOperation(operations: any[], atomic: boolean = true): string {
    const operationId = this.generateOperationId();
    const operation: FileOperation = {
      id: operationId,
      type: "batch",
      status: "completed",
      timestamp: new Date(),
      details: { operations, atomic },
    };

    this.operations.set(operationId, operation);
    return operationId;
  }

  /**
   * Record a watch session
   */
  recordWatchSession(
    path: string,
    recursive: boolean = false,
    filters: string[] = []
  ): string {
    const sessionId = this.generateOperationId();
    const session: WatchSession = {
      id: sessionId,
      path,
      recursive,
      filters,
      eventCount: 0,
      startTime: new Date(),
    };

    this.watchSessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Stop watching a directory
   */
  stopWatch(sessionId: string): void {
    try {
      const session = this.watchSessions.get(sessionId);
      if (!session) {
        // Log warning but don't throw - handle gracefully
        this.outputChannel.appendLine(
          `Warning: Watch session not found: ${sessionId}`
        );
        if (this.errorHandler) {
          this.errorHandler.handleError({
            name: "WatchSessionNotFoundError",
            message: `Watch session not found: ${sessionId}`,
            category: ErrorCategory.USER_ERROR,
            context: { sessionId },
          });
        }
        return;
      }
      this.watchSessions.delete(sessionId);
      this.outputChannel.appendLine(`Watch session stopped: ${sessionId}`);
    } catch (error: any) {
      // Log error but don't throw - handle gracefully
      this.outputChannel.appendLine(
        `Error stopping watch session: ${error.message || error}`
      );
      if (this.errorHandler) {
        this.errorHandler.handleError({
          name: "StopWatchError",
          message: error.message || "Failed to stop watch session",
          category: ErrorCategory.SYSTEM_ERROR,
          context: { sessionId },
          originalError: error,
        });
      }
    }
  }

  /**
   * Record a search operation
   */
  recordSearchOperation(
    query: string,
    searchType: "name" | "content" | "both" = "name",
    fileTypes?: string[]
  ): string {
    const operationId = this.generateOperationId();
    const operation: FileOperation = {
      id: operationId,
      type: "search",
      status: "completed",
      timestamp: new Date(),
      details: { query, searchType, fileTypes },
    };

    this.operations.set(operationId, operation);
    return operationId;
  }

  /**
   * Record a checksum operation
   */
  recordChecksumOperation(
    path: string,
    algorithm: "md5" | "sha1" | "sha256" | "sha512" = "sha256"
  ): string {
    const operationId = this.generateOperationId();
    const operation: FileOperation = {
      id: operationId,
      type: "checksum",
      status: "completed",
      timestamp: new Date(),
      details: { path, algorithm },
    };

    this.operations.set(operationId, operation);
    return operationId;
  }

  /**
   * Record a disk usage operation
   */
  recordDiskUsageOperation(
    path: string,
    depth?: number,
    groupByType: boolean = false
  ): string {
    const operationId = this.generateOperationId();
    const operation: FileOperation = {
      id: operationId,
      type: "disk_usage",
      status: "completed",
      timestamp: new Date(),
      details: { path, depth, groupByType },
    };

    this.operations.set(operationId, operation);
    return operationId;
  }

  /**
   * Get all operations
   */
  getOperations(): FileOperation[] {
    return Array.from(this.operations.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get recent operations
   */
  getRecentOperations(limit: number = 10): FileOperation[] {
    return this.getOperations().slice(0, limit);
  }

  /**
   * Get all watch sessions
   */
  getWatchSessions(): WatchSession[] {
    return Array.from(this.watchSessions.values());
  }

  /**
   * Clear operation history
   */
  clearOperations(): void {
    this.operations.clear();
  }

  /**
   * Execute batch operations (stub - actual implementation via MCP server)
   */
  async batchOperations(params: {
    operations: any[];
    atomic?: boolean;
  }): Promise<any> {
    const operationId = this.recordBatchOperation(
      params.operations,
      params.atomic ?? true
    );
    this.outputChannel.appendLine(`Batch operations recorded: ${operationId}`);
    return {
      status: "success",
      operationId,
      results: params.operations.map((op) => ({
        type: op.type,
        source: op.source,
        destination: op.destination,
        status: "completed",
      })),
    };
  }

  /**
   * Watch directory (stub - actual implementation via MCP server)
   */
  async watchDirectory(params: {
    path: string;
    recursive?: boolean;
    filters?: string[];
  }): Promise<any> {
    const sessionId = this.recordWatchSession(
      params.path,
      params.recursive ?? false,
      params.filters ?? []
    );
    this.outputChannel.appendLine(`Watch session started: ${sessionId}`);
    return {
      status: "success",
      sessionId,
      path: params.path,
      recursive: params.recursive ?? false,
    };
  }

  /**
   * Get watch events (stub - actual implementation via MCP server)
   */
  async getWatchEvents(params: { sessionId: string }): Promise<any> {
    try {
      const session = this.watchSessions.get(params.sessionId);
      if (!session) {
        const error = new Error(`Watch session not found: ${params.sessionId}`);
        if (this.errorHandler) {
          this.errorHandler.handleError({
            name: "WatchSessionNotFoundError",
            message: error.message,
            category: ErrorCategory.USER_ERROR,
            context: { sessionId: params.sessionId },
          });
        }
        throw error;
      }
      return {
        status: "success",
        sessionId: params.sessionId,
        events: [],
        eventCount: session.eventCount,
      };
    } catch (error: any) {
      if (this.errorHandler && !error.category) {
        this.errorHandler.handleError({
          name: "GetWatchEventsError",
          message: error.message || "Failed to get watch events",
          category: ErrorCategory.SYSTEM_ERROR,
          context: { sessionId: params.sessionId },
          originalError: error,
        });
      }
      throw error;
    }
  }

  /**
   * Search files (stub - actual implementation via MCP server)
   */
  async searchFiles(params: {
    query: string;
    searchType?: "name" | "content" | "both";
    fileTypes?: string[];
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: string;
    useIndex?: boolean;
  }): Promise<any> {
    const operationId = this.recordSearchOperation(
      params.query,
      params.searchType ?? "name",
      params.fileTypes
    );
    this.outputChannel.appendLine(`Search operation recorded: ${operationId}`);
    return {
      status: "success",
      operationId,
      query: params.query,
      results: [],
      resultCount: 0,
    };
  }

  /**
   * Build index (stub - actual implementation via MCP server)
   */
  async buildIndex(params: {
    path: string;
    includeContent?: boolean;
  }): Promise<any> {
    this.outputChannel.appendLine(`Building index for: ${params.path}`);
    return {
      status: "success",
      path: params.path,
      fileCount: 0,
      totalSize: 0,
      indexSize: 0,
    };
  }

  /**
   * Create symlink (stub - actual implementation via MCP server)
   */
  async createSymlink(params: {
    linkPath: string;
    targetPath: string;
  }): Promise<any> {
    this.outputChannel.appendLine(
      `Creating symlink: ${params.linkPath} -> ${params.targetPath}`
    );
    return {
      status: "success",
      linkPath: params.linkPath,
      targetPath: params.targetPath,
    };
  }

  /**
   * Compute checksum (stub - actual implementation via MCP server)
   */
  async computeChecksum(params: {
    path: string;
    algorithm?: "md5" | "sha1" | "sha256" | "sha512";
  }): Promise<any> {
    const operationId = this.recordChecksumOperation(
      params.path,
      params.algorithm ?? "sha256"
    );
    this.outputChannel.appendLine(
      `Checksum operation recorded: ${operationId}`
    );
    return {
      status: "success",
      operationId,
      path: params.path,
      algorithm: params.algorithm ?? "sha256",
      checksum:
        "0000000000000000000000000000000000000000000000000000000000000000",
    };
  }

  /**
   * Verify checksum (stub - actual implementation via MCP server)
   */
  async verifyChecksum(params: {
    path: string;
    checksum: string;
    algorithm?: "md5" | "sha1" | "sha256" | "sha512";
  }): Promise<any> {
    this.outputChannel.appendLine(`Verifying checksum for: ${params.path}`);
    return {
      status: "success",
      path: params.path,
      algorithm: params.algorithm ?? "sha256",
      expectedChecksum: params.checksum,
      actualChecksum:
        "0000000000000000000000000000000000000000000000000000000000000000",
      verified: false,
    };
  }

  /**
   * Analyze disk usage (stub - actual implementation via MCP server)
   */
  async analyzeDiskUsage(params: {
    path: string;
    depth?: number;
    groupByType?: boolean;
  }): Promise<any> {
    const operationId = this.recordDiskUsageOperation(
      params.path,
      params.depth,
      params.groupByType ?? false
    );
    this.outputChannel.appendLine(
      `Disk usage operation recorded: ${operationId}`
    );
    return {
      status: "success",
      operationId,
      path: params.path,
      totalSize: 0,
      fileCount: 0,
      directoryCount: 0,
      largestFiles: [],
      typeBreakdown: {},
    };
  }

  /**
   * Copy directory (stub - actual implementation via MCP server)
   */
  async copyDirectory(params: {
    source: string;
    destination: string;
    preserveMetadata?: boolean;
    exclusions?: string[];
  }): Promise<any> {
    this.outputChannel.appendLine(
      `Copying directory: ${params.source} -> ${params.destination}`
    );
    return {
      status: "success",
      source: params.source,
      destination: params.destination,
      filesCopied: 0,
      bytesCopied: 0,
      duration: 0,
    };
  }

  /**
   * Sync directory (stub - actual implementation via MCP server)
   */
  async syncDirectory(params: {
    source: string;
    destination: string;
    exclusions?: string[];
  }): Promise<any> {
    this.outputChannel.appendLine(
      `Syncing directory: ${params.source} -> ${params.destination}`
    );
    return {
      status: "success",
      source: params.source,
      destination: params.destination,
      filesCopied: 0,
      filesSkipped: 0,
      bytesCopied: 0,
      duration: 0,
    };
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

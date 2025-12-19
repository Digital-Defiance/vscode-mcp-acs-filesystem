import * as vscode from "vscode";
import * as path from "path";
import {
  BaseMCPClient,
  LogOutputChannel,
} from "@ai-capabilities-suite/mcp-client-base";
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

export interface SecurityConfig {
  workspaceRoot: string;
  allowedSubdirectories: string[];
  blockedPaths: string[];
  blockedPatterns: string[];
  maxFileSize: number;
  maxBatchSize: number;
  maxOperationsPerMinute: number;
}

/**
 * Filesystem client that extends BaseMCPClient for consistent timeout handling
 * and connection management across all MCP ACS extensions
 */
export class MCPFilesystemClient extends BaseMCPClient {
  private operations: Map<string, FileOperation> = new Map();
  private watchSessions: Map<string, WatchSession> = new Map();
  private settingsManager?: SettingsManager;
  private errorHandler?: ErrorHandler;
  private settingsSubscription?: vscode.Disposable;
  private serverConfig?: SecurityConfig;

  constructor(
    outputChannel: LogOutputChannel,
    settingsManager?: SettingsManager,
    errorHandler?: ErrorHandler
  ) {
    super("Filesystem", outputChannel);
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

  /**
   * Set the server configuration to be passed via IPC
   * @param config The SecurityConfig to pass to the server
   */
  public setServerConfig(config: SecurityConfig): void {
    this.serverConfig = config;
  }

  async connect(): Promise<void> {
    return this.start();
  }

  async disconnect(): Promise<void> {
    this.stop();
  }

  // ========== Abstract Method Implementations ==========

  protected getServerCommand(): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration("mcp-filesystem");
    const serverPath = config.get<string>("server.serverPath");

    let serverCommand: string;
    let args: string[] = [];

    if (process.env.VSCODE_TEST_MODE === "true") {
      try {
        // In test mode, use the local build
        let extensionPath = "";
        const extension = vscode.extensions.getExtension(
          "DigitalDefiance.mcp-acs-filesystem"
        );
        if (extension) {
          extensionPath = extension.extensionPath;
        }

        if (extensionPath) {
          serverCommand = "node";
          const serverScript = path.resolve(
            extensionPath,
            "../mcp-filesystem/dist/cli.js"
          );
          args = [serverScript];
        } else {
          serverCommand =
            serverPath && serverPath.length > 0 ? serverPath : "mcp-filesystem";
        }
      } catch (error) {
        serverCommand =
          serverPath && serverPath.length > 0 ? serverPath : "mcp-filesystem";
      }
    } else {
      if (serverPath && serverPath.length > 0) {
        serverCommand = serverPath;
      } else {
        // Use npx to run the server
        serverCommand = process.platform === "win32" ? "npx.cmd" : "npx";
        args = ["-y", "@ai-capabilities-suite/mcp-filesystem"];
      }
    }

    return { command: serverCommand, args };
  }

  protected getServerEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // Copy process.env, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Pass configuration via environment variable
    if (this.serverConfig) {
      env["MCP_FILESYSTEM_CONFIG"] = JSON.stringify(this.serverConfig);
      this.log(
        "info",
        "Passing configuration via MCP_FILESYSTEM_CONFIG environment variable"
      );
    }

    return env;
  }

  protected async onServerReady(): Promise<void> {
    // Send initialized notification
    await this.sendNotification("initialized", {});

    // Load configuration - list available tools
    try {
      const tools = await this.sendRequest("tools/list", {});
      this.log("info", `Server tools loaded: ${JSON.stringify(tools)}`);
    } catch (error) {
      this.log("warn", `Failed to list tools: ${error}`);
    }

    // Log current settings
    if (this.settingsManager) {
      const settings = this.settingsManager.getSettings();
      this.log("info", `Server timeout: ${settings.server.timeout}ms`);
      this.log("info", `Max file size: ${settings.security.maxFileSize} bytes`);
      this.log(
        "info",
        `Max batch size: ${settings.security.maxBatchSize} bytes`
      );
    }
  }

  // Override stop to add cleanup
  override stop(): void {
    this.operations.clear();
    this.watchSessions.clear();

    // Unsubscribe from settings changes
    if (this.settingsSubscription) {
      this.settingsSubscription.dispose();
      this.settingsSubscription = undefined;
    }

    // Call parent stop
    super.stop();
  }

  isRunning(): boolean {
    return this.isServerProcessAlive();
  }

  /**
   * Handle settings changes
   */
  private onSettingsChanged(settings: any): void {
    this.log("info", "MCP client settings updated");

    // Log relevant setting changes
    this.log("info", `Server timeout: ${settings.server.timeout}ms`);
    this.log(
      "info",
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
        this.log("warn", `Watch session not found: ${sessionId}`);
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
      this.log("info", `Watch session stopped: ${sessionId}`);
    } catch (error: any) {
      // Log error but don't throw - handle gracefully
      this.log(
        "error",
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

  // ========== Filesystem-Specific Methods ==========

  /**
   * Execute batch operations
   */
  async batchOperations(params: {
    operations: any[];
    atomic?: boolean;
  }): Promise<any> {
    const operationId = this.recordBatchOperation(
      params.operations,
      params.atomic ?? true
    );
    this.log("info", `Batch operations recorded: ${operationId}`);

    const result = await this.callTool("fs_batch_operations", params);
    return result;
  }

  /**
   * Watch directory
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
    this.log("info", `Watch session started: ${sessionId}`);

    const result = await this.callTool("fs_watch_directory", params);
    return { ...result, sessionId };
  }

  /**
   * Get watch events
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

      const result = await this.callTool("fs_get_watch_events", params);
      return result;
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
   * Search files
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
    this.log("info", `Search operation recorded: ${operationId}`);

    const result = await this.callTool("fs_search_files", params);
    return result;
  }

  /**
   * Build index
   */
  async buildIndex(params: {
    path: string;
    includeContent?: boolean;
  }): Promise<any> {
    this.log("info", `Building index for: ${params.path}`);
    const result = await this.callTool("fs_build_index", params);
    return result;
  }

  /**
   * Create symlink
   */
  async createSymlink(params: {
    linkPath: string;
    targetPath: string;
  }): Promise<any> {
    this.log(
      "info",
      `Creating symlink: ${params.linkPath} -> ${params.targetPath}`
    );
    const result = await this.callTool("fs_create_symlink", params);
    return result;
  }

  /**
   * Compute checksum
   */
  async computeChecksum(params: {
    path: string;
    algorithm?: "md5" | "sha1" | "sha256" | "sha512";
  }): Promise<any> {
    const operationId = this.recordChecksumOperation(
      params.path,
      params.algorithm ?? "sha256"
    );
    this.log("info", `Checksum operation recorded: ${operationId}`);

    const result = await this.callTool("fs_compute_checksum", params);
    return result;
  }

  /**
   * Verify checksum
   */
  async verifyChecksum(params: {
    path: string;
    checksum: string;
    algorithm?: "md5" | "sha1" | "sha256" | "sha512";
  }): Promise<any> {
    this.log("info", `Verifying checksum for: ${params.path}`);
    const result = await this.callTool("fs_verify_checksum", params);
    return result;
  }

  /**
   * Analyze disk usage
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
    this.log("info", `Disk usage operation recorded: ${operationId}`);

    const result = await this.callTool("fs_analyze_disk_usage", params);
    return result;
  }

  /**
   * Copy directory
   */
  async copyDirectory(params: {
    source: string;
    destination: string;
    preserveMetadata?: boolean;
    exclusions?: string[];
  }): Promise<any> {
    this.log(
      "info",
      `Copying directory: ${params.source} -> ${params.destination}`
    );
    const result = await this.callTool("fs_copy_directory", params);
    return result;
  }

  /**
   * Sync directory
   */
  async syncDirectory(params: {
    source: string;
    destination: string;
    exclusions?: string[];
  }): Promise<any> {
    this.log(
      "info",
      `Syncing directory: ${params.source} -> ${params.destination}`
    );
    const result = await this.callTool("fs_sync_directory", params);
    return result;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Override callTool to handle MCP-specific response format
  protected override async callTool(
    name: string,
    args: unknown
  ): Promise<unknown> {
    const result = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as any;

    if (result.isError) {
      throw new Error(result.content[0]?.text || "Tool call failed");
    }

    // Parse result content
    const content = result.content[0]?.text;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }

    return result;
  }
}

import * as vscode from "vscode";
import { MCPFilesystemClient, FileOperation, WatchSession } from "./mcpClient";
import { SettingsManager } from "./settingsManager";
import { ErrorHandler, ErrorCategory } from "./errorHandling";

/**
 * Operations Tree Data Provider
 * Displays filesystem operations and watch sessions in the VS Code sidebar
 */
export class OperationsTreeDataProvider
  implements vscode.TreeDataProvider<OperationItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    OperationItem | undefined | null | void
  > = new vscode.EventEmitter<OperationItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    OperationItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private mcpClient: MCPFilesystemClient | undefined;
  private settingsManager?: SettingsManager;
  private errorHandler?: ErrorHandler;
  private settingsSubscription?: vscode.Disposable;

  /**
   * Create a new Operations Tree Data Provider
   * @param settingsManager - Optional settings manager for configuration access
   * @param errorHandler - Optional error handler for error reporting
   */
  constructor(settingsManager?: SettingsManager, errorHandler?: ErrorHandler) {
    this.settingsManager = settingsManager;
    this.errorHandler = errorHandler;

    // Subscribe to settings changes
    if (this.settingsManager) {
      this.settingsSubscription = this.settingsManager.onDidChange(() => {
        this.refresh();
      });
    }
  }

  /**
   * Set the MCP client instance
   * @param client - The MCP filesystem client to use for operations
   */
  setMCPClient(client: MCPFilesystemClient | undefined): void {
    this.mcpClient = client;
    this.refresh();
  }

  /**
   * Refresh the tree view
   * Triggers a re-render of all tree items
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Dispose resources
   * Cleans up subscriptions and event emitters
   */
  dispose(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.dispose();
    }
    this._onDidChangeTreeData.dispose();
  }

  /**
   * Get tree item representation
   * @param element - The operation item to convert to a tree item
   * @returns The VS Code tree item
   */
  getTreeItem(element: OperationItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   * @param element - The parent element, or undefined for root items
   * @returns Promise resolving to array of child items
   */
  getChildren(element?: OperationItem): Thenable<OperationItem[]> {
    try {
      if (!element) {
        // Root level - show main categories
        const items: OperationItem[] = [
          new OperationItem(
            "Quick Actions",
            "",
            vscode.TreeItemCollapsibleState.Expanded,
            "category",
            undefined,
            "quick-actions"
          ),
        ];

        // Add watch sessions if any
        if (this.mcpClient) {
          try {
            const sessions = this.mcpClient.getWatchSessions();
            if (sessions.length > 0) {
              items.push(
                new OperationItem(
                  "Active Watch Sessions",
                  `${sessions.length} active`,
                  vscode.TreeItemCollapsibleState.Expanded,
                  "category",
                  undefined,
                  "watch-sessions"
                )
              );
            }

            // Add recent operations
            const operations = this.mcpClient.getRecentOperations(5);
            if (operations.length > 0) {
              items.push(
                new OperationItem(
                  "Recent Operations",
                  `${operations.length} recent`,
                  vscode.TreeItemCollapsibleState.Collapsed,
                  "category",
                  undefined,
                  "recent-operations"
                )
              );
            }
          } catch (error: any) {
            if (this.errorHandler) {
              this.errorHandler.handleError({
                name: "TreeProviderError",
                message: error.message || "Failed to load operations",
                category: ErrorCategory.SYSTEM_ERROR,
                context: { component: "OperationsTreeProvider" },
                originalError: error,
              });
            }
          }
        }

        return Promise.resolve(items);
      }

      // Handle children based on category
      if (element.categoryId === "quick-actions") {
        return Promise.resolve([
          new OperationItem(
            "Batch Operations",
            "Execute multiple file operations",
            vscode.TreeItemCollapsibleState.None,
            "batch",
            "mcp-filesystem.batchOperations"
          ),
          new OperationItem(
            "Watch Directory",
            "Monitor directory for changes",
            vscode.TreeItemCollapsibleState.None,
            "watch",
            "mcp-filesystem.watchDirectory"
          ),
          new OperationItem(
            "Search Files",
            "Search by name or content",
            vscode.TreeItemCollapsibleState.None,
            "search",
            "mcp-filesystem.searchFiles"
          ),
          new OperationItem(
            "Compute Checksum",
            "Verify file integrity",
            vscode.TreeItemCollapsibleState.None,
            "checksum",
            "mcp-filesystem.computeChecksum"
          ),
          new OperationItem(
            "Analyze Disk Usage",
            "View directory sizes",
            vscode.TreeItemCollapsibleState.None,
            "disk",
            "mcp-filesystem.analyzeDiskUsage"
          ),
        ]);
      }

      if (element.categoryId === "watch-sessions" && this.mcpClient) {
        try {
          const sessions = this.mcpClient.getWatchSessions();
          return Promise.resolve(
            sessions.map(
              (session) =>
                new OperationItem(
                  session.path,
                  `${session.eventCount} events`,
                  vscode.TreeItemCollapsibleState.None,
                  "watch-session",
                  undefined,
                  undefined,
                  session
                )
            )
          );
        } catch (error: any) {
          if (this.errorHandler) {
            this.errorHandler.handleError({
              name: "TreeProviderError",
              message: error.message || "Failed to load watch sessions",
              category: ErrorCategory.SYSTEM_ERROR,
              context: {
                component: "OperationsTreeProvider",
                category: "watch-sessions",
              },
              originalError: error,
            });
          }
          return Promise.resolve([]);
        }
      }

      if (element.categoryId === "recent-operations" && this.mcpClient) {
        try {
          const operations = this.mcpClient.getRecentOperations(5);
          return Promise.resolve(
            operations.map(
              (op) =>
                new OperationItem(
                  `${op.type} - ${op.status}`,
                  new Date(op.timestamp).toLocaleTimeString(),
                  vscode.TreeItemCollapsibleState.None,
                  "operation",
                  undefined,
                  undefined,
                  undefined,
                  op
                )
            )
          );
        } catch (error: any) {
          if (this.errorHandler) {
            this.errorHandler.handleError({
              name: "TreeProviderError",
              message: error.message || "Failed to load recent operations",
              category: ErrorCategory.SYSTEM_ERROR,
              context: {
                component: "OperationsTreeProvider",
                category: "recent-operations",
              },
              originalError: error,
            });
          }
          return Promise.resolve([]);
        }
      }

      return Promise.resolve([]);
    } catch (error: any) {
      if (this.errorHandler) {
        this.errorHandler.handleError({
          name: "TreeProviderError",
          message: error.message || "Failed to get tree children",
          category: ErrorCategory.SYSTEM_ERROR,
          context: { component: "OperationsTreeProvider" },
          originalError: error,
        });
      }
      return Promise.resolve([]);
    }
  }
}

class OperationItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly operationType: string,
    public readonly commandId?: string,
    public readonly categoryId?: string,
    public readonly watchSession?: WatchSession,
    public readonly operation?: FileOperation
  ) {
    super(label, collapsibleState);
    this.description = description;

    // Build tooltip
    if (watchSession) {
      this.tooltip = `Path: ${watchSession.path}\nRecursive: ${
        watchSession.recursive
      }\nFilters: ${watchSession.filters.join(", ") || "none"}\nEvents: ${
        watchSession.eventCount
      }\nStarted: ${watchSession.startTime.toLocaleString()}`;
    } else if (operation) {
      this.tooltip = `Type: ${operation.type}\nStatus: ${
        operation.status
      }\nTime: ${operation.timestamp.toLocaleString()}`;
      if (operation.error) {
        this.tooltip += `\nError: ${operation.error}`;
      }
    } else {
      this.tooltip = description;
    }

    if (commandId) {
      this.command = {
        command: commandId,
        title: label,
      };
    }

    // Set context value for context menus
    if (watchSession) {
      this.contextValue = "watchSession";
    } else if (operation) {
      this.contextValue = "operation";
    }

    // Set icon based on operation type
    switch (operationType) {
      case "category":
        this.iconPath = new vscode.ThemeIcon("folder");
        break;
      case "batch":
        this.iconPath = new vscode.ThemeIcon("files");
        break;
      case "watch":
        this.iconPath = new vscode.ThemeIcon("eye");
        break;
      case "watch-session":
        this.iconPath = new vscode.ThemeIcon("eye-watch");
        break;
      case "search":
        this.iconPath = new vscode.ThemeIcon("search");
        break;
      case "checksum":
        this.iconPath = new vscode.ThemeIcon("shield");
        break;
      case "disk":
        this.iconPath = new vscode.ThemeIcon("graph");
        break;
      case "operation":
        if (operation) {
          switch (operation.status) {
            case "completed":
              this.iconPath = new vscode.ThemeIcon(
                "check",
                new vscode.ThemeColor("testing.iconPassed")
              );
              break;
            case "failed":
              this.iconPath = new vscode.ThemeIcon(
                "error",
                new vscode.ThemeColor("testing.iconFailed")
              );
              break;
            case "running":
              this.iconPath = new vscode.ThemeIcon("sync~spin");
              break;
            default:
              this.iconPath = new vscode.ThemeIcon("circle-outline");
          }
        }
        break;
      default:
        this.iconPath = new vscode.ThemeIcon("file");
    }
  }
}

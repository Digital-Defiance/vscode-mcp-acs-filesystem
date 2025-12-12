import * as vscode from "vscode";
import { SettingsManager } from "./settingsManager";
import { ErrorHandler, ErrorCategory } from "./errorHandling";

/**
 * Security Tree Data Provider
 * Displays security boundaries and configuration in the VS Code sidebar
 */
export class SecurityTreeDataProvider
  implements vscode.TreeDataProvider<SecurityItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    SecurityItem | undefined | null | void
  > = new vscode.EventEmitter<SecurityItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SecurityItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private settingsManager?: SettingsManager;
  private errorHandler?: ErrorHandler;
  private settingsSubscription?: vscode.Disposable;

  /**
   * Create a new Security Tree Data Provider
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
   * Refresh the tree view
   * Triggers a re-render of all tree items
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   * @param element - The security item to convert to a tree item
   * @returns The VS Code tree item
   */
  getTreeItem(element: SecurityItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   * @param element - The parent element, or undefined for root items
   * @returns Promise resolving to array of child items
   */
  getChildren(element?: SecurityItem): Thenable<SecurityItem[]> {
    try {
      if (!element) {
        // Root level - show security categories
        let workspaceRoot: string;
        let allowedSubdirs: string[];
        let blockedPaths: string[];
        let blockedPatterns: string[];
        let maxFileSize: number;
        let maxBatchSize: number;
        let maxOpsPerMin: number;

        if (this.settingsManager) {
          const settings = this.settingsManager.getSettings();
          workspaceRoot = settings.security.workspaceRoot;
          allowedSubdirs = settings.security.allowedSubdirectories;
          blockedPaths = settings.security.blockedPaths;
          blockedPatterns = settings.security.blockedPatterns;
          maxFileSize = settings.security.maxFileSize;
          maxBatchSize = settings.security.maxBatchSize;
          maxOpsPerMin = settings.security.maxOperationsPerMinute;
        } else {
          // Fallback to direct config access
          const config = vscode.workspace.getConfiguration("mcp-filesystem");
          workspaceRoot = config.get<string>(
            "security.workspaceRoot",
            "${workspaceFolder}"
          );
          allowedSubdirs = config.get<string[]>(
            "security.allowedSubdirectories",
            []
          );
          blockedPaths = config.get<string[]>("security.blockedPaths", []);
          blockedPatterns = config.get<string[]>(
            "security.blockedPatterns",
            []
          );
          maxFileSize = config.get<number>("resources.maxFileSize", 104857600);
          maxBatchSize = config.get<number>(
            "resources.maxBatchSize",
            1073741824
          );
          maxOpsPerMin = config.get<number>(
            "resources.maxOperationsPerMinute",
            100
          );
        }

        return Promise.resolve([
          new SecurityItem(
            "Workspace Root",
            workspaceRoot,
            vscode.TreeItemCollapsibleState.None,
            "workspace",
            "All operations confined to this directory"
          ),
          new SecurityItem(
            "Allowed Subdirectories",
            allowedSubdirs.length > 0
              ? allowedSubdirs.join(", ")
              : "All (within workspace)",
            vscode.TreeItemCollapsibleState.None,
            "allowed",
            "Accessible subdirectories"
          ),
          new SecurityItem(
            "Blocked Paths",
            blockedPaths.join(", "),
            vscode.TreeItemCollapsibleState.None,
            "blocked",
            "Always blocked paths"
          ),
          new SecurityItem(
            "Blocked Patterns",
            blockedPatterns.join(", "),
            vscode.TreeItemCollapsibleState.None,
            "patterns",
            "Blocked file patterns"
          ),
          new SecurityItem(
            "Max File Size",
            `${(maxFileSize / 1024 / 1024).toFixed(0)} MB`,
            vscode.TreeItemCollapsibleState.None,
            "limit",
            "Maximum file size for operations"
          ),
          new SecurityItem(
            "Max Batch Size",
            `${(maxBatchSize / 1024 / 1024 / 1024).toFixed(1)} GB`,
            vscode.TreeItemCollapsibleState.None,
            "limit",
            "Maximum total batch size"
          ),
          new SecurityItem(
            "Rate Limit",
            `${maxOpsPerMin} ops/min`,
            vscode.TreeItemCollapsibleState.None,
            "limit",
            "Maximum operations per minute"
          ),
        ]);
      }

      return Promise.resolve([]);
    } catch (error: any) {
      if (this.errorHandler) {
        this.errorHandler.handleError({
          name: "SecurityTreeProviderError",
          message: error.message || "Failed to load security information",
          category: ErrorCategory.SYSTEM_ERROR,
          context: { component: "SecurityTreeDataProvider" },
          originalError: error,
        });
      }
      return Promise.resolve([]);
    }
  }

  dispose(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.dispose();
    }
    this._onDidChangeTreeData.dispose();
  }
}

class SecurityItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly value: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly securityType: string,
    public readonly tooltipText: string
  ) {
    super(label, collapsibleState);
    this.description = value;
    this.tooltip = tooltipText;

    // Set icon based on security type
    switch (securityType) {
      case "workspace":
        this.iconPath = new vscode.ThemeIcon("folder");
        break;
      case "allowed":
        this.iconPath = new vscode.ThemeIcon("check");
        break;
      case "blocked":
        this.iconPath = new vscode.ThemeIcon("error");
        break;
      case "patterns":
        this.iconPath = new vscode.ThemeIcon("regex");
        break;
      case "limit":
        this.iconPath = new vscode.ThemeIcon("dashboard");
        break;
      default:
        this.iconPath = new vscode.ThemeIcon("lock");
    }
  }
}

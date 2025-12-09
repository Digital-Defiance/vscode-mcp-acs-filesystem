import * as vscode from "vscode";

export class SecurityTreeDataProvider
  implements vscode.TreeDataProvider<SecurityItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    SecurityItem | undefined | null | void
  > = new vscode.EventEmitter<SecurityItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SecurityItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SecurityItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SecurityItem): Thenable<SecurityItem[]> {
    if (!element) {
      // Root level - show security categories
      const config = vscode.workspace.getConfiguration("mcp-filesystem");
      const workspaceRoot = config.get<string>(
        "security.workspaceRoot",
        "${workspaceFolder}"
      );
      const allowedSubdirs = config.get<string[]>(
        "security.allowedSubdirectories",
        []
      );
      const blockedPaths = config.get<string[]>("security.blockedPaths", []);
      const blockedPatterns = config.get<string[]>(
        "security.blockedPatterns",
        []
      );
      const maxFileSize = config.get<number>(
        "resources.maxFileSize",
        104857600
      );
      const maxBatchSize = config.get<number>(
        "resources.maxBatchSize",
        1073741824
      );
      const maxOpsPerMin = config.get<number>(
        "resources.maxOperationsPerMinute",
        100
      );

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

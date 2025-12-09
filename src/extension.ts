import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  registerExtension,
  unregisterExtension,
  setOutputChannel,
} from "@ai-capabilities-suite/vscode-shared-status-bar";
import { OperationsTreeDataProvider } from "./operationsTreeProvider";
import { SecurityTreeDataProvider } from "./securityTreeProvider";
import { MCPFilesystemClient } from "./mcpClient";

let mcpClient: MCPFilesystemClient | undefined;
let outputChannel: vscode.LogOutputChannel;
let statusBarItem: vscode.StatusBarItem | undefined;
let operationsTreeProvider: OperationsTreeDataProvider;
let securityTreeProvider: SecurityTreeDataProvider;
let refreshInterval: NodeJS.Timeout | undefined;

/**
 * Add this MCP server to the workspace mcp.json configuration
 */
async function configureMcpServer(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    const choice = await vscode.window.showWarningMessage(
      "No workspace folder open. Would you like to add the MCP server to your user settings instead?",
      "Add to User Settings",
      "Cancel"
    );
    if (choice === "Add to User Settings") {
      await vscode.commands.executeCommand("workbench.action.openSettingsJson");
      vscode.window.showInformationMessage(
        "Add the MCP server configuration manually. See the extension README for details."
      );
    }
    return;
  }

  const workspaceFolder = workspaceFolders[0];
  const vscodePath = path.join(workspaceFolder.uri.fsPath, ".vscode");
  const mcpJsonPath = path.join(vscodePath, "mcp.json");

  // Ensure .vscode directory exists
  if (!fs.existsSync(vscodePath)) {
    fs.mkdirSync(vscodePath, { recursive: true });
  }

  // Read existing mcp.json or create new one
  let mcpConfig: { servers?: Record<string, any> } = { servers: {} };
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const content = fs.readFileSync(mcpJsonPath, "utf8");
      mcpConfig = JSON.parse(content);
      if (!mcpConfig.servers) {
        mcpConfig.servers = {};
      }
    } catch (error) {
      outputChannel.appendLine(`Error reading mcp.json: ${error}`);
    }
  }

  // Add our server configuration
  const serverName = "mcp-filesystem";
  if (mcpConfig.servers && mcpConfig.servers[serverName]) {
    const choice = await vscode.window.showWarningMessage(
      `MCP server "${serverName}" is already configured. Do you want to replace it?`,
      "Replace",
      "Cancel"
    );
    if (choice !== "Replace") {
      return;
    }
  }

  mcpConfig.servers = mcpConfig.servers || {};
  mcpConfig.servers[serverName] = {
    type: "stdio",
    command: "npx",
    args: ["-y", "@ai-capabilities-suite/mcp-filesystem"],
  };

  // Write the updated configuration
  fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));

  // Open the file to show the user
  const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(
    `MCP Filesystem Manager server added to ${mcpJsonPath}. Restart the MCP server to use it with Copilot.`
  );
}

/**
 * Show security boundaries dialog
 */
async function showSecurityBoundaries(): Promise<void> {
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
  const blockedPatterns = config.get<string[]>("security.blockedPatterns", []);

  const message = `
**Security Boundaries**

**Workspace Root:** ${workspaceRoot}
All operations are confined to this directory.

**Allowed Subdirectories:** ${
    allowedSubdirs.length > 0
      ? allowedSubdirs.join(", ")
      : "All (within workspace)"
  }

**Blocked Paths:** ${blockedPaths.join(", ")}

**Blocked Patterns:** ${blockedPatterns.join(", ")}

**What AI Agents CANNOT Do:**
- Access files outside the workspace root
- Access system directories (/etc, /sys, C:\\Windows, etc.)
- Access SSH keys, AWS credentials, or other sensitive files
- Create symlinks pointing outside the workspace
- Bypass rate limits
- Disable audit logging

**What AI Agents CAN Do (Within Workspace):**
- Read, write, and delete files
- Create and navigate directories
- Search for files by name or content
- Watch directories for changes
- Compute checksums
- Create symlinks (within workspace)
- Batch operations
- Sync directories
  `.trim();

  await vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Batch operations command
 */
async function batchOperations(): Promise<void> {
  const operationType = await vscode.window.showQuickPick(
    ["Copy", "Move", "Delete"],
    {
      placeHolder: "Select operation type",
    }
  );

  if (!operationType) {
    return;
  }

  vscode.window.showInformationMessage(
    `Batch ${operationType} operations - Use Copilot with @filesystem for AI-assisted batch operations`
  );
}

/**
 * Watch directory command
 */
async function watchDirectory(): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Watch Directory",
  });

  if (!uri || uri.length === 0) {
    return;
  }

  vscode.window.showInformationMessage(
    `Directory watching - Use Copilot with @filesystem to watch ${uri[0].fsPath}`
  );
}

/**
 * Search files command
 */
async function searchFiles(): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: "Enter search query",
    placeHolder: "*.ts or search term",
  });

  if (!query) {
    return;
  }

  vscode.window.showInformationMessage(
    `File search - Use Copilot with @filesystem to search for "${query}"`
  );
}

/**
 * Compute checksum command
 */
async function computeChecksum(): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: "Compute Checksum",
  });

  if (!uri || uri.length === 0) {
    return;
  }

  const algorithm = await vscode.window.showQuickPick(
    ["md5", "sha1", "sha256", "sha512"],
    {
      placeHolder: "Select hash algorithm",
    }
  );

  if (!algorithm) {
    return;
  }

  vscode.window.showInformationMessage(
    `Checksum computation - Use Copilot with @filesystem to compute ${algorithm} for ${uri[0].fsPath}`
  );
}

/**
 * Analyze disk usage command
 */
async function analyzeDiskUsage(): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Analyze Disk Usage",
  });

  if (!uri || uri.length === 0) {
    return;
  }

  vscode.window.showInformationMessage(
    `Disk usage analysis - Use Copilot with @filesystem to analyze ${uri[0].fsPath}`
  );
}

/**
 * Open settings command
 */
async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "mcp-filesystem"
  );
}

/**
 * Start auto-refresh for operations view
 */
function startAutoRefresh(): void {
  // Clear existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  const config = vscode.workspace.getConfiguration("mcp-filesystem");
  const interval = config.get<number>("ui.refreshInterval", 5000);

  if (interval > 0) {
    refreshInterval = setInterval(() => {
      operationsTreeProvider.refresh();
    }, interval);
  }
}

/**
 * Show restart notification
 */
function showRestartNotification(): void {
  const isTestMode =
    process.env.VSCODE_TEST_MODE === "true" || process.env.NODE_ENV === "test";

  if (isTestMode) {
    outputChannel.appendLine(
      "Configuration change requires restart (test mode - skipping notification)"
    );
    return;
  }

  vscode.window
    .showWarningMessage(
      "MCP Filesystem configuration changed. Server restart required for changes to take effect.",
      "Restart Now",
      "Restart Later"
    )
    .then((selection) => {
      if (selection === "Restart Now") {
        restartServer();
      }
    });
}

/**
 * Restart the MCP server
 */
async function restartServer(): Promise<void> {
  try {
    outputChannel.appendLine("Restarting MCP Filesystem server...");

    // Stop existing server
    if (mcpClient) {
      mcpClient.stop();
      mcpClient = undefined;
    }

    // Wait a moment for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Start new server
    mcpClient = new MCPFilesystemClient(outputChannel);
    await mcpClient.start();

    // Update providers
    operationsTreeProvider.setMCPClient(mcpClient);

    outputChannel.appendLine("MCP Filesystem server restarted successfully");
    vscode.window.showInformationMessage(
      "MCP Filesystem server restarted successfully"
    );

    // Refresh views
    operationsTreeProvider.refresh();
  } catch (error: any) {
    outputChannel.appendLine(`Failed to restart MCP server: ${error}`);
    vscode.window.showErrorMessage(
      `Failed to restart MCP Filesystem server: ${error.message || error}`
    );
  }
}

/**
 * Stop watch session
 */
async function stopWatchSession(item: any): Promise<void> {
  if (!mcpClient) {
    vscode.window.showErrorMessage("MCP client not connected");
    return;
  }

  if (!item || !item.watchSession) {
    vscode.window.showErrorMessage("No watch session selected");
    return;
  }

  try {
    await mcpClient.stopWatch(item.watchSession.id);
    vscode.window.showInformationMessage(
      `Stopped watching ${item.watchSession.path}`
    );
    operationsTreeProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to stop watch: ${error}`);
  }
}

/**
 * View operation details
 */
async function viewOperationDetails(item: any): Promise<void> {
  if (!item || !item.operation) {
    vscode.window.showErrorMessage("No operation selected");
    return;
  }

  const op = item.operation;
  const panel = vscode.window.createWebviewPanel(
    "operationDetails",
    `Operation: ${op.type}`,
    vscode.ViewColumn.One,
    {}
  );

  panel.webview.html = getOperationDetailsHTML(op);
}

/**
 * Clear operation history
 */
async function clearOperationHistory(): Promise<void> {
  if (!mcpClient) {
    vscode.window.showErrorMessage("MCP client not connected");
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    "Clear all operation history?",
    { modal: true },
    "Clear",
    "Cancel"
  );

  if (choice === "Clear") {
    mcpClient.clearOperations();
    operationsTreeProvider.refresh();
    vscode.window.showInformationMessage("Operation history cleared");
  }
}

/**
 * Get operation details HTML
 */
function getOperationDetailsHTML(operation: any): string {
  const statusColor =
    operation.status === "completed"
      ? "#4caf50"
      : operation.status === "failed"
      ? "#f44336"
      : "#ff9800";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
        }
        h1 {
          color: ${statusColor};
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          background: var(--vscode-editor-background);
          border-radius: 4px;
        }
        .label {
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
        }
        pre {
          background: var(--vscode-textCodeBlock-background);
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
        }
        .error {
          color: var(--vscode-errorForeground);
        }
      </style>
    </head>
    <body>
      <h1>${operation.type.toUpperCase()} - ${operation.status.toUpperCase()}</h1>
      
      <div class="section">
        <div class="label">Operation ID:</div>
        <div>${operation.id}</div>
      </div>

      <div class="section">
        <div class="label">Timestamp:</div>
        <div>${new Date(operation.timestamp).toLocaleString()}</div>
      </div>

      <div class="section">
        <div class="label">Details:</div>
        <pre>${JSON.stringify(operation.details, null, 2)}</pre>
      </div>

      ${
        operation.result
          ? `
      <div class="section">
        <div class="label">Result:</div>
        <pre>${JSON.stringify(operation.result, null, 2)}</pre>
      </div>
      `
          : ""
      }

      ${
        operation.error
          ? `
      <div class="section error">
        <div class="label">Error:</div>
        <pre>${operation.error}</pre>
      </div>
      `
          : ""
      }
    </body>
    </html>
  `;
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("MCP Filesystem Manager", {
    log: true,
  });
  outputChannel.appendLine("MCP Filesystem Manager extension activating...");

  // Check if we're running in test mode
  const isTestMode =
    process.env.VSCODE_TEST_MODE === "true" ||
    process.env.NODE_ENV === "test" ||
    context.extensionMode === vscode.ExtensionMode.Test;

  if (isTestMode) {
    outputChannel.appendLine(
      "Running in test mode - skipping server initialization"
    );
  }

  // Register MCP server definition provider
  try {
    const mcpProviderId = "mcp-acs-filesystem.mcp-provider";
    const mcpProvider: vscode.McpServerDefinitionProvider = {
      provideMcpServerDefinitions: async (token) => {
        const config = vscode.workspace.getConfiguration("mcp-filesystem");
        const serverPath = config.get<string>("server.serverPath", "");
        const command = serverPath || "npx";
        const args = serverPath
          ? []
          : ["-y", "@ai-capabilities-suite/mcp-filesystem"];

        return [
          new vscode.McpStdioServerDefinition(
            "MCP Filesystem Manager",
            command,
            args
          ),
        ];
      },
      resolveMcpServerDefinition: async (server, token) => {
        return server;
      },
    };

    context.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider(mcpProviderId, mcpProvider)
    );
    outputChannel.appendLine("MCP server definition provider registered");
  } catch (error) {
    outputChannel.appendLine(
      `MCP provider registration skipped (API not available): ${error}`
    );
  }

  // Register chat participant for Copilot integration
  const participant = vscode.chat.createChatParticipant(
    "mcp-acs-filesystem.participant",
    async (request, context, stream, token) => {
      const prompt = request.prompt;
      stream.markdown(`Processing: ${prompt}\n\n`);

      if (
        prompt.includes("batch") ||
        prompt.includes("copy") ||
        prompt.includes("move")
      ) {
        stream.markdown(
          "Use batch operations for efficient file manipulation..."
        );
      } else if (prompt.includes("watch") || prompt.includes("monitor")) {
        stream.markdown(
          "Directory watching allows real-time file system monitoring..."
        );
      } else if (prompt.includes("search") || prompt.includes("find")) {
        stream.markdown(
          "File search supports name, content, and metadata queries..."
        );
      } else if (prompt.includes("checksum") || prompt.includes("hash")) {
        stream.markdown(
          "Checksum computation supports MD5, SHA-1, SHA-256, and SHA-512..."
        );
      } else if (
        prompt.includes("disk") ||
        prompt.includes("usage") ||
        prompt.includes("size")
      ) {
        stream.markdown(
          "Disk usage analysis provides detailed size breakdowns..."
        );
      } else {
        stream.markdown(
          "Available operations:\n- Batch file operations\n- Directory watching\n- File search\n- Checksum computation\n- Disk usage analysis"
        );
      }
    }
  );

  context.subscriptions.push(participant);

  // Register language model tools
  try {
    const tools = [
      {
        name: "fs_batch_operations",
        tool: {
          description: "Execute multiple filesystem operations atomically",
          inputSchema: {
            type: "object",
            properties: {
              operations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["copy", "move", "delete"] },
                    source: { type: "string" },
                    destination: { type: "string" },
                  },
                },
              },
              atomic: { type: "boolean" },
            },
            required: ["operations"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.batchOperations(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_watch_directory",
        tool: {
          description: "Watch directory for filesystem changes",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              recursive: { type: "boolean" },
              filters: { type: "array", items: { type: "string" } },
            },
            required: ["path"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.watchDirectory(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_get_watch_events",
        tool: {
          description: "Get accumulated events from a watch session",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: { type: "string" },
            },
            required: ["sessionId"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.getWatchEvents(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_stop_watch",
        tool: {
          description: "Stop a directory watch session",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: { type: "string" },
            },
            required: ["sessionId"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.stopWatch(options.input.sessionId);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_search_files",
        tool: {
          description: "Search for files by name, content, or metadata",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              searchType: { type: "string", enum: ["name", "content", "both"] },
              fileTypes: { type: "array", items: { type: "string" } },
              minSize: { type: "number" },
              maxSize: { type: "number" },
              modifiedAfter: { type: "string" },
              useIndex: { type: "boolean" },
            },
            required: ["query"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.searchFiles(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_build_index",
        tool: {
          description: "Build file index for fast searching",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              includeContent: { type: "boolean" },
            },
            required: ["path"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.buildIndex(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_create_symlink",
        tool: {
          description: "Create a symbolic link",
          inputSchema: {
            type: "object",
            properties: {
              linkPath: { type: "string" },
              targetPath: { type: "string" },
            },
            required: ["linkPath", "targetPath"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.createSymlink(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_compute_checksum",
        tool: {
          description: "Compute file checksums",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              algorithm: {
                type: "string",
                enum: ["md5", "sha1", "sha256", "sha512"],
              },
            },
            required: ["path"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.computeChecksum(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_verify_checksum",
        tool: {
          description: "Verify file checksum",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              checksum: { type: "string" },
              algorithm: {
                type: "string",
                enum: ["md5", "sha1", "sha256", "sha512"],
              },
            },
            required: ["path", "checksum"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.verifyChecksum(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_analyze_disk_usage",
        tool: {
          description: "Analyze disk usage and directory sizes",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              depth: { type: "number" },
              groupByType: { type: "boolean" },
            },
            required: ["path"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.analyzeDiskUsage(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_copy_directory",
        tool: {
          description: "Copy directory recursively",
          inputSchema: {
            type: "object",
            properties: {
              source: { type: "string" },
              destination: { type: "string" },
              preserveMetadata: { type: "boolean" },
              exclusions: { type: "array", items: { type: "string" } },
            },
            required: ["source", "destination"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.copyDirectory(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
      {
        name: "fs_sync_directory",
        tool: {
          description: "Sync directories (copy only newer or missing files)",
          inputSchema: {
            type: "object",
            properties: {
              source: { type: "string" },
              destination: { type: "string" },
              exclusions: { type: "array", items: { type: "string" } },
            },
            required: ["source", "destination"],
          },
          invoke: async (
            options: vscode.LanguageModelToolInvocationOptions<any>,
            token: vscode.CancellationToken
          ) => {
            if (!mcpClient) {
              throw new Error("MCP Filesystem server not running");
            }
            const result = await mcpClient.syncDirectory(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
          },
        },
      },
    ];

    for (const { name, tool } of tools) {
      context.subscriptions.push(vscode.lm.registerTool(name, tool));
    }
    outputChannel.appendLine(`Registered ${tools.length} language model tools`);
  } catch (error) {
    outputChannel.appendLine(
      `Tool registration skipped (API not available): ${error}`
    );
  }

  // Initialize MCP client
  const config = vscode.workspace.getConfiguration("mcp-filesystem");
  const autoStart = config.get<boolean>("server.autoStart", true);

  if (autoStart && !isTestMode) {
    try {
      mcpClient = new MCPFilesystemClient(outputChannel);
      await mcpClient.start();
      outputChannel.appendLine("MCP Filesystem client started successfully");
    } catch (error) {
      outputChannel.appendLine(`Failed to start MCP client: ${error}`);
      vscode.window.showWarningMessage(
        "MCP Filesystem server could not be started. Some features may be unavailable."
      );
    }
  }

  // Initialize tree providers
  operationsTreeProvider = new OperationsTreeDataProvider();
  securityTreeProvider = new SecurityTreeDataProvider();

  // Set MCP client in providers
  if (mcpClient) {
    operationsTreeProvider.setMCPClient(mcpClient);
  }

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "mcp-filesystem-operations",
      operationsTreeProvider
    )
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "mcp-filesystem-security",
      securityTreeProvider
    )
  );

  // Start auto-refresh for operations view
  startAutoRefresh();

  // Listen for configuration changes to refresh security view
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("mcp-filesystem")) {
        securityTreeProvider.refresh();

        // Restart server if needed
        if (e.affectsConfiguration("mcp-filesystem.server")) {
          showRestartNotification();
        }

        // Update refresh interval
        if (e.affectsConfiguration("mcp-filesystem.ui.refreshInterval")) {
          startAutoRefresh();
        }
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("mcp-filesystem.configureMcp", async () => {
      await configureMcpServer();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.batchOperations",
      async () => {
        await batchOperations();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.watchDirectory",
      async () => {
        await watchDirectory();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mcp-filesystem.searchFiles", async () => {
      await searchFiles();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.computeChecksum",
      async () => {
        await computeChecksum();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.analyzeDiskUsage",
      async () => {
        await analyzeDiskUsage();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.showSecurityBoundaries",
      async () => {
        await showSecurityBoundaries();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.refreshOperations",
      async () => {
        operationsTreeProvider.refresh();
        securityTreeProvider.refresh();
        vscode.window.showInformationMessage("Operations refreshed");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mcp-filesystem.openSettings", async () => {
      await openSettings();
    })
  );

  // Register new commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.restartServer",
      async () => {
        await restartServer();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.stopWatchSession",
      async (item) => {
        await stopWatchSession(item);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.viewOperationDetails",
      async (item) => {
        await viewOperationDetails(item);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcp-filesystem.clearOperationHistory",
      async () => {
        await clearOperationHistory();
      }
    )
  );

  outputChannel.appendLine("MCP Filesystem Manager extension activated");

  // Register with shared status bar
  await registerExtension("mcp-acs-filesystem", {
    displayName: "MCP Filesystem",
    status: "ok",
    settingsQuery: "mcp-filesystem",
    actions: [
      {
        label: "Batch Operations",
        command: "mcp-filesystem.batchOperations",
        description: "Execute batch file operations",
      },
      {
        label: "Search Files",
        command: "mcp-filesystem.searchFiles",
        description: "Search for files",
      },
      {
        label: "Security Boundaries",
        command: "mcp-filesystem.showSecurityBoundaries",
        description: "View security configuration",
      },
    ],
  });
  context.subscriptions.push({
    dispose: () => unregisterExtension("mcp-acs-filesystem"),
  });
}

export async function deactivate() {
  await unregisterExtension("mcp-acs-filesystem");
  outputChannel?.dispose();
  statusBarItem?.dispose();
}

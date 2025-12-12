import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  Hover,
  CompletionItem,
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  CodeAction,
  CodeActionKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceRoot: string = "";
let blockedPaths: string[] = [];
let blockedPatterns: string[] = [];

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = params.workspaceFolders[0].uri;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["/", ".", '"', "'"],
      },
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix],
      },
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }

  connection.console.log("MCP Filesystem Language Server initialized");
});

// Configuration change handler
connection.onDidChangeConfiguration(async (change) => {
  if (hasConfigurationCapability) {
    // Fetch updated configuration
    const config = await connection.workspace.getConfiguration({
      section: "mcp-filesystem",
    });

    if (config) {
      blockedPaths = config.security?.blockedPaths || [];
      blockedPatterns = config.security?.blockedPatterns || [];
      workspaceRoot = config.security?.workspaceRoot || workspaceRoot;
    }

    // Revalidate all open documents
    documents.all().forEach(validateTextDocument);
  }
});

documents.onDidOpen((event: any) => {
  validateTextDocument(event.document);
});

documents.onDidChangeContent((change: any) => {
  validateTextDocument(change.document);
});

documents.onDidClose((event: any) => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

/**
 * Validate text document for filesystem-related issues
 */
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  try {
    const diagnostics: Diagnostic[] = [];
    const text = textDocument.getText();
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for paths outside workspace root
      const pathMatches = line.matchAll(/['"]([^'"]*\/[^'"]*)['"]/g);
      for (const match of pathMatches) {
        if (match[1]) {
          const path = match[1];

          // Check if path appears to be outside workspace
          if (path.startsWith("/") && !path.includes("workspace")) {
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: match.index || 0 },
                end: {
                  line: i,
                  character: (match.index || 0) + match[0].length,
                },
              },
              message:
                "Path may be outside workspace root. Ensure filesystem operations are confined to workspace.",
              source: "mcp-filesystem",
            });
          }

          // Check for blocked paths
          for (const blocked of blockedPaths) {
            if (path.includes(blocked)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                  start: { line: i, character: match.index || 0 },
                  end: {
                    line: i,
                    character: (match.index || 0) + match[0].length,
                  },
                },
                message: `Path contains blocked directory: ${blocked}`,
                source: "mcp-filesystem",
              });
            }
          }

          // Check for blocked patterns
          for (const pattern of blockedPatterns) {
            const regex = new RegExp(pattern.replace(/\*/g, ".*"));
            if (regex.test(path)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                  start: { line: i, character: match.index || 0 },
                  end: {
                    line: i,
                    character: (match.index || 0) + match[0].length,
                  },
                },
                message: `Path matches blocked pattern: ${pattern}`,
                source: "mcp-filesystem",
              });
            }
          }
        }
      }

      // Check for dangerous filesystem operations
      if (line.includes("fs.unlinkSync") || line.includes("fs.rmdirSync")) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          message:
            "Consider using async filesystem operations for better performance and error handling.",
          source: "mcp-filesystem",
        });
      }

      // Check for symlink operations
      if (line.includes("fs.symlink") || line.includes("fs.symlinkSync")) {
        diagnostics.push({
          severity: DiagnosticSeverity.Information,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          message:
            "Symlink operations should be validated to ensure they stay within workspace boundaries.",
          source: "mcp-filesystem",
        });
      }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (error) {
    connection.console.error(
      `Error validating document ${textDocument.uri}: ${error}`
    );
    // Continue operating - don't let validation errors break the LSP
  }
}

/**
 * Provide hover information for filesystem paths
 */
connection.onHover(async (params: any): Promise<Hover | null> => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const line = text.split("\n")[params.position.line];

    // Check if hovering over a filesystem path
    const pathMatch = line.match(/['"]([^'"]*\/[^'"]*)['"]/);
    if (pathMatch && pathMatch[1]) {
      const path = pathMatch[1];

      return {
        contents: {
          kind: "markdown",
          value: [
            `**Filesystem Path**`,
            "",
            `Path: \`${path}\``,
            "",
            "**MCP ACS Filesystem Manager** provides secure file operations:",
            "- All operations confined to workspace root",
            "- Blocked paths and patterns enforced",
            "- Audit logging enabled",
            "",
            "Use `@filesystem` in Copilot for AI-assisted file operations.",
          ].join("\n"),
        },
      };
    }

    // Check if hovering over filesystem operations
    const word = getWordAtPosition(text, offset);
    if (word) {
      const fsOperations: Record<string, string> = {
        readFile: "Read file contents with security validation",
        writeFile: "Write file contents within workspace boundaries",
        unlink: "Delete file with audit logging",
        mkdir: "Create directory within workspace",
        rmdir: "Remove directory with validation",
        stat: "Get file metadata and permissions",
        readdir: "List directory contents",
        copyFile: "Copy file within workspace",
        rename: "Rename or move file",
        symlink: "Create symbolic link (validated)",
      };

      if (fsOperations[word]) {
        return {
          contents: {
            kind: "markdown",
            value: [
              `**Filesystem Operation: ${word}**`,
              "",
              fsOperations[word],
              "",
              "**Security:** All operations are validated against workspace boundaries.",
            ].join("\n"),
          },
        };
      }
    }

    return null;
  } catch (error) {
    connection.console.error(`Error in hover provider: ${error}`);
    return null;
  }
});

/**
 * Provide completion suggestions for filesystem paths
 */
connection.onCompletion(async (params: any): Promise<CompletionItem[]> => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const position = params.position;
    const line = text.split("\n")[position.line];

    const completions: CompletionItem[] = [];

    // Suggest MCP filesystem tools
    if (line.includes("mcpClient.") || line.includes("@filesystem")) {
      completions.push(
        {
          label: "batchOperations",
          kind: CompletionItemKind.Method,
          detail: "Execute multiple filesystem operations atomically",
          documentation:
            "Batch operations allow you to perform multiple file operations as a single atomic transaction.",
          insertText: "batchOperations({ operations: [] })",
        },
        {
          label: "watchDirectory",
          kind: CompletionItemKind.Method,
          detail: "Watch directory for filesystem changes",
          documentation:
            "Monitor a directory for file system events like create, modify, delete.",
          insertText: "watchDirectory({ path: '', recursive: false })",
        },
        {
          label: "searchFiles",
          kind: CompletionItemKind.Method,
          detail: "Search for files by name, content, or metadata",
          documentation:
            "Search for files using various criteria including name patterns, content, and metadata.",
          insertText: "searchFiles({ query: '', searchType: 'name' })",
        },
        {
          label: "computeChecksum",
          kind: CompletionItemKind.Method,
          detail: "Compute file checksums",
          documentation:
            "Calculate cryptographic checksums (MD5, SHA-1, SHA-256, SHA-512) for files.",
          insertText: "computeChecksum({ path: '', algorithm: 'sha256' })",
        },
        {
          label: "analyzeDiskUsage",
          kind: CompletionItemKind.Method,
          detail: "Analyze disk usage and directory sizes",
          documentation:
            "Get detailed disk usage statistics for directories and files.",
          insertText: "analyzeDiskUsage({ path: '', depth: 2 })",
        },
        {
          label: "createSymlink",
          kind: CompletionItemKind.Method,
          detail: "Create a symbolic link",
          documentation: "Create a symbolic link within workspace boundaries.",
          insertText: "createSymlink({ linkPath: '', targetPath: '' })",
        },
        {
          label: "copyDirectory",
          kind: CompletionItemKind.Method,
          detail: "Copy directory recursively",
          documentation:
            "Recursively copy a directory with optional metadata preservation.",
          insertText:
            "copyDirectory({ source: '', destination: '', preserveMetadata: true })",
        },
        {
          label: "syncDirectory",
          kind: CompletionItemKind.Method,
          detail: "Sync directories (copy only newer or missing files)",
          documentation:
            "Synchronize directories by copying only newer or missing files.",
          insertText: "syncDirectory({ source: '', destination: '' })",
        }
      );
    }

    // Suggest common filesystem paths
    if (line.includes('"') || line.includes("'")) {
      completions.push(
        {
          label: "./",
          kind: CompletionItemKind.Folder,
          detail: "Current directory",
          insertText: "./",
        },
        {
          label: "../",
          kind: CompletionItemKind.Folder,
          detail: "Parent directory",
          insertText: "../",
        },
        {
          label: "src/",
          kind: CompletionItemKind.Folder,
          detail: "Source directory",
          insertText: "src/",
        },
        {
          label: "dist/",
          kind: CompletionItemKind.Folder,
          detail: "Distribution directory",
          insertText: "dist/",
        }
      );
    }

    return completions;
  } catch (error) {
    connection.console.error(`Error in completion provider: ${error}`);
    return [];
  }
});

/**
 * Provide code actions for quick fixes
 */
connection.onCodeAction(async (params: any): Promise<CodeAction[]> => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const codeActions: CodeAction[] = [];
    const diagnostics = params.context.diagnostics;

    for (const diagnostic of diagnostics) {
      // Quick fix for paths outside workspace
      if (diagnostic.message.includes("outside workspace")) {
        codeActions.push({
          title: "Use workspace-relative path",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [params.textDocument.uri]: [
                {
                  range: diagnostic.range,
                  newText:
                    "// TODO: Update path to be relative to workspace root",
                },
              ],
            },
          },
        });
      }

      // Quick fix for blocked paths
      if (diagnostic.message.includes("blocked")) {
        codeActions.push({
          title: "Remove blocked path reference",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [params.textDocument.uri]: [
                {
                  range: diagnostic.range,
                  newText: "// TODO: Remove reference to blocked path",
                },
              ],
            },
          },
        });

        codeActions.push({
          title: "Configure security settings",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          command: {
            title: "Open MCP Filesystem Settings",
            command: "mcp-filesystem.openSettings",
          },
        });
      }

      // Quick fix for sync operations
      if (diagnostic.message.includes("async")) {
        codeActions.push({
          title: "Convert to async operation",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [params.textDocument.uri]: [
                {
                  range: diagnostic.range,
                  newText:
                    "// TODO: Convert to async filesystem operation (e.g., fs.promises)",
                },
              ],
            },
          },
        });
      }
    }

    return codeActions;
  } catch (error) {
    connection.console.error(`Error in code action provider: ${error}`);
    return [];
  }
});

/**
 * Get word at position
 */
function getWordAtPosition(text: string, offset: number): string | null {
  const wordPattern = /\b\w+\b/g;
  let match;

  while ((match = wordPattern.exec(text)) !== null) {
    if (match.index <= offset && offset <= match.index + match[0].length) {
      return match[0];
    }
  }

  return null;
}

/**
 * Provide context for Copilot
 * This is called when Copilot needs information about filesystem capabilities
 */
connection.onRequest("copilot/getContext", async (): Promise<any> => {
  try {
    return {
      filesystemTools: [
        {
          name: "batchOperations",
          description: "Execute multiple filesystem operations atomically",
          capabilities: ["copy", "move", "delete"],
        },
        {
          name: "watchDirectory",
          description: "Watch directory for filesystem changes",
          capabilities: ["recursive", "filters", "event-accumulation"],
        },
        {
          name: "searchFiles",
          description: "Search for files by name, content, or metadata",
          capabilities: ["name-search", "content-search", "metadata-filters"],
        },
        {
          name: "computeChecksum",
          description: "Compute file checksums",
          capabilities: ["md5", "sha1", "sha256", "sha512"],
        },
        {
          name: "analyzeDiskUsage",
          description: "Analyze disk usage and directory sizes",
          capabilities: ["recursive", "type-grouping", "size-breakdown"],
        },
        {
          name: "createSymlink",
          description: "Create symbolic links",
          capabilities: ["workspace-validation"],
        },
        {
          name: "copyDirectory",
          description: "Copy directory recursively",
          capabilities: ["metadata-preservation", "exclusions"],
        },
        {
          name: "syncDirectory",
          description: "Sync directories",
          capabilities: ["incremental", "exclusions"],
        },
      ],
      securityBoundaries: {
        workspaceRoot: workspaceRoot,
        blockedPaths: blockedPaths,
        blockedPatterns: blockedPatterns,
        restrictions: [
          "All operations confined to workspace root",
          "System directories are blocked",
          "Sensitive files (keys, credentials) are blocked",
          "Audit logging is enabled",
        ],
      },
      features: {
        batchOperations: true,
        directoryWatching: true,
        fileSearch: true,
        checksumComputation: true,
        diskUsageAnalysis: true,
        symbolicLinks: true,
        directorySync: true,
      },
    };
  } catch (error) {
    connection.console.error(`Error providing Copilot context: ${error}`);
    return {
      error: "Failed to provide context",
      filesystemTools: [],
      securityBoundaries: {},
      features: {},
    };
  }
});

documents.listen(connection);
connection.listen();

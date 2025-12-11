import * as vscode from "vscode";
import * as path from "path";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

/**
 * Filesystem Language Server Client
 * Manages the lifecycle of the LSP server for filesystem operations
 */
export class FilesystemLanguageServer {
  private client: LanguageClient | undefined;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
  }

  /**
   * Start the language server
   */
  async start(): Promise<void> {
    try {
      this.outputChannel.appendLine("Starting Filesystem Language Server...");

      // The server is implemented in Node
      const serverModule = this.context.asAbsolutePath(
        path.join("out", "languageServer.js")
      );

      // The debug options for the server
      const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

      // If the extension is launched in debug mode then the debug server options are used
      // Otherwise the run options are used
      const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
          module: serverModule,
          transport: TransportKind.ipc,
          options: debugOptions,
        },
      };

      // Options to control the language client
      const clientOptions: LanguageClientOptions = {
        // Register the server for JavaScript and TypeScript documents
        documentSelector: [
          { scheme: "file", language: "javascript" },
          { scheme: "file", language: "typescript" },
          { scheme: "file", language: "javascriptreact" },
          { scheme: "file", language: "typescriptreact" },
          { scheme: "untitled", language: "javascript" },
          { scheme: "untitled", language: "typescript" },
          { scheme: "untitled", language: "javascriptreact" },
          { scheme: "untitled", language: "typescriptreact" },
        ],
        synchronize: {
          // Notify the server about file changes to configuration files
          fileEvents: vscode.workspace.createFileSystemWatcher("**/.mcprc"),
        },
        outputChannel: this.outputChannel,
      };

      // Create the language client and start the client
      this.client = new LanguageClient(
        "mcpFilesystemLanguageServer",
        "MCP Filesystem Language Server",
        serverOptions,
        clientOptions
      );

      // Start the client. This will also launch the server
      await this.client.start();

      this.outputChannel.appendLine(
        "Filesystem Language Server started successfully"
      );
    } catch (error) {
      this.outputChannel.appendLine(
        `Failed to start Filesystem Language Server: ${error}`
      );
      throw error;
    }
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    try {
      if (this.client) {
        this.outputChannel.appendLine("Stopping Filesystem Language Server...");
        await this.client.stop();
        this.client = undefined;
        this.outputChannel.appendLine(
          "Filesystem Language Server stopped successfully"
        );
      }
    } catch (error) {
      this.outputChannel.appendLine(
        `Error stopping Filesystem Language Server: ${error}`
      );
      // Continue - don't throw on stop errors
    }
  }

  /**
   * Check if the language server is running
   */
  isRunning(): boolean {
    return this.client !== undefined;
  }

  /**
   * Get the language client instance
   */
  getClient(): LanguageClient | undefined {
    return this.client;
  }
}

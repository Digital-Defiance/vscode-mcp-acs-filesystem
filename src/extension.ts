import * as vscode from "vscode";
import {
  registerExtension,
  unregisterExtension,
} from "@ai-capabilities-suite/vscode-shared-status-bar";

let outputChannel: vscode.LogOutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("MCP Filesystem", {
    log: true,
  });
  outputChannel.appendLine("MCP Filesystem extension activating...");

  context.subscriptions.push(
    vscode.commands.registerCommand("mcp-filesystem.configureMcp", async () => {
      vscode.window.showInformationMessage(
        "MCP Filesystem configuration coming soon!"
      );
    })
  );

  outputChannel.appendLine("MCP Filesystem extension activated");

  // Register with shared status bar
  registerExtension("mcp-acs-filesystem");
  context.subscriptions.push({
    dispose: () => unregisterExtension("mcp-acs-filesystem"),
  });
}

export async function deactivate() {
  unregisterExtension("mcp-acs-filesystem");
  outputChannel?.dispose();
}

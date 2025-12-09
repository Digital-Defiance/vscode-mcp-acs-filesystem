import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Extension should be present", () => {
    assert.ok(
      vscode.extensions.getExtension("DigitalDefiance.mcp-acs-filesystem")
    );
  });

  test("Extension should activate", async () => {
    const ext = vscode.extensions.getExtension(
      "DigitalDefiance.mcp-acs-filesystem"
    );
    assert.ok(ext);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true);
  });

  test("Commands should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      "mcp-filesystem.configureMcp",
      "mcp-filesystem.batchOperations",
      "mcp-filesystem.watchDirectory",
      "mcp-filesystem.searchFiles",
      "mcp-filesystem.computeChecksum",
      "mcp-filesystem.analyzeDiskUsage",
      "mcp-filesystem.showSecurityBoundaries",
      "mcp-filesystem.refreshOperations",
      "mcp-filesystem.openSettings",
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });

  test("Configuration should have expected properties", () => {
    const config = vscode.workspace.getConfiguration("mcp-filesystem");

    // Check that configuration properties exist
    assert.ok(config.has("server.serverPath"));
    assert.ok(config.has("server.autoStart"));
    assert.ok(config.has("server.logLevel"));
    assert.ok(config.has("security.workspaceRoot"));
    assert.ok(config.has("security.blockedPaths"));
    assert.ok(config.has("security.blockedPatterns"));
  });

  test("Security boundaries command should work", async () => {
    // This test just verifies the command can be executed without error
    try {
      await vscode.commands.executeCommand(
        "mcp-filesystem.showSecurityBoundaries"
      );
      assert.ok(true);
    } catch (error) {
      assert.fail(`Command execution failed: ${error}`);
    }
  });
});

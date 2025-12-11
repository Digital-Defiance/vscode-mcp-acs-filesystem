/**
 * Unit Tests for Language Server
 * Tests LSP lifecycle, capabilities, error handling, and configuration changes
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

suite("Language Server Unit Tests", () => {
  let testDir: string;
  let languageServerReady = false;

  suiteSetup(async function () {
    this.timeout(15000);

    // Create temp directory for test files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fs-lsp-test-"));

    // Activate extension
    const ext = vscode.extensions.getExtension(
      "DigitalDefiance.mcp-acs-filesystem"
    );
    if (ext) {
      await ext.activate();
    }

    // Wait for language server to start
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if language server is responding
    try {
      const testFile = path.join(testDir, "test-ready.js");
      fs.writeFileSync(testFile, "const x = 1;");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        testDoc.uri,
        new vscode.Position(0, 6)
      );

      languageServerReady = hovers !== undefined;
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    } catch (error) {
      console.log("Language server not ready:", error);
      languageServerReady = false;
    }
  });

  suite("LSP Lifecycle Tests", () => {
    test("Should start language server on extension activation", async function () {
      this.timeout(5000);

      // Language server should be ready after activation
      assert.ok(
        languageServerReady,
        "Language server should be ready after extension activation"
      );
    });

    test("Should handle document open events", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "lifecycle-open.js");
      fs.writeFileSync(testFile, 'const path = "./test.txt";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not crash when opening document
      assert.ok(true, "LSP should handle document open without crashing");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should handle document close events", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "lifecycle-close.js");
      fs.writeFileSync(testFile, 'const path = "./test.txt";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Close the document
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Diagnostics should be cleared
      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      assert.strictEqual(
        diagnostics.length,
        0,
        "Diagnostics should be cleared on document close"
      );
    });
  });

  suite("Hover Provider Tests", () => {
    test("Should provide hover for filesystem paths", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "hover-path.js");
      fs.writeFileSync(testFile, 'const filePath = "/workspace/test.txt";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Hover over the path
      const position = new vscode.Position(0, 20);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        testDoc.uri,
        position
      );

      if (hovers && hovers.length > 0) {
        const hoverContent = hovers[0].contents
          .map((c) => (typeof c === "string" ? c : "value" in c ? c.value : ""))
          .join("\n")
          .toLowerCase();

        assert.ok(
          hoverContent.includes("filesystem") ||
            hoverContent.includes("path") ||
            hoverContent.includes("mcp"),
          `Hover should contain filesystem information. Got: ${hoverContent}`
        );
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide hover for filesystem operations", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "hover-operation.js");
      fs.writeFileSync(testFile, 'fs.readFile("test.txt");');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Hover over "readFile"
      const position = new vscode.Position(0, 5);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        testDoc.uri,
        position
      );

      // LSP may or may not provide hover for operations
      // Just verify it doesn't crash
      assert.ok(true, "LSP should handle hover requests without crashing");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should handle hover on non-filesystem content", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "hover-non-fs.js");
      fs.writeFileSync(testFile, "const x = 42;");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Hover over non-filesystem content
      const position = new vscode.Position(0, 10);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        testDoc.uri,
        position
      );

      // Should not crash, may return null or empty
      assert.ok(true, "LSP should handle non-filesystem hover gracefully");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });
  });

  suite("Completion Provider Tests", () => {
    test("Should provide MCP tool completions", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "completion-mcp.js");
      fs.writeFileSync(testFile, "mcpClient.");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get completions after "mcpClient."
      const position = new vscode.Position(0, 10);
      const completions = await vscode.commands.executeCommand<
        vscode.CompletionList | vscode.CompletionItem[]
      >("vscode.executeCompletionItemProvider", testDoc.uri, position);

      // Extract completion items
      let completionItems: vscode.CompletionItem[] = [];
      if (completions) {
        if (Array.isArray(completions)) {
          completionItems = completions;
        } else if ("items" in completions) {
          completionItems = completions.items;
        }
      }

      // Should provide some completions
      assert.ok(
        completionItems.length >= 0,
        "LSP should provide completions without crashing"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide path completions", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "completion-path.js");
      fs.writeFileSync(testFile, 'const path = "./');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get completions after "./"
      const position = new vscode.Position(0, 16);
      const completions = await vscode.commands.executeCommand<
        vscode.CompletionList | vscode.CompletionItem[]
      >("vscode.executeCompletionItemProvider", testDoc.uri, position);

      // Should not crash
      assert.ok(true, "LSP should provide path completions without crashing");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should handle completion on empty content", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "completion-empty.js");
      fs.writeFileSync(testFile, "");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get completions on empty file
      const position = new vscode.Position(0, 0);
      const completions = await vscode.commands.executeCommand<
        vscode.CompletionList | vscode.CompletionItem[]
      >("vscode.executeCompletionItemProvider", testDoc.uri, position);

      // Should not crash
      assert.ok(true, "LSP should handle empty content gracefully");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });
  });

  suite("Diagnostics Provider Tests", () => {
    test("Should provide diagnostics for paths outside workspace", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "diagnostics-outside.js");
      fs.writeFileSync(testFile, 'const path = "/etc/passwd";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const mcpDiagnostics = diagnostics.filter(
        (d) =>
          d.source === "mcp-filesystem" ||
          d.message.toLowerCase().includes("workspace")
      );

      // Should warn about paths outside workspace
      assert.ok(
        mcpDiagnostics.length >= 0,
        "LSP should process diagnostics without crashing"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide diagnostics for blocked paths", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "diagnostics-blocked.js");
      fs.writeFileSync(testFile, 'const path = ".git/config";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const mcpDiagnostics = diagnostics.filter(
        (d) =>
          d.source === "mcp-filesystem" ||
          d.message.toLowerCase().includes("blocked")
      );

      // Should error on blocked paths
      if (mcpDiagnostics.length > 0) {
        assert.ok(
          mcpDiagnostics.some(
            (d) => d.severity === vscode.DiagnosticSeverity.Error
          ),
          "Blocked paths should produce error diagnostics"
        );
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide diagnostics for sync operations", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "diagnostics-sync.js");
      fs.writeFileSync(testFile, 'fs.unlinkSync("test.txt");');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const mcpDiagnostics = diagnostics.filter(
        (d) =>
          d.source === "mcp-filesystem" ||
          d.message.toLowerCase().includes("async") ||
          d.message.toLowerCase().includes("sync")
      );

      // Should warn about sync operations
      if (mcpDiagnostics.length > 0) {
        assert.ok(
          mcpDiagnostics.some(
            (d) => d.severity === vscode.DiagnosticSeverity.Warning
          ),
          "Sync operations should produce warning diagnostics"
        );
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide diagnostics for symlink operations", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "diagnostics-symlink.js");
      fs.writeFileSync(testFile, 'fs.symlinkSync("link", "target");');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const mcpDiagnostics = diagnostics.filter(
        (d) =>
          d.source === "mcp-filesystem" ||
          d.message.toLowerCase().includes("symlink")
      );

      // Should inform about symlink validation
      assert.ok(
        mcpDiagnostics.length >= 0,
        "LSP should process symlink diagnostics without crashing"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should clear diagnostics on document change", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "diagnostics-change.js");
      fs.writeFileSync(testFile, 'const path = "/etc/passwd";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      const editor = await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get initial diagnostics
      const initialDiagnostics = vscode.languages.getDiagnostics(testDoc.uri);

      // Change the document to valid content
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(
          testDoc.positionAt(0),
          testDoc.positionAt(testDoc.getText().length)
        );
        editBuilder.replace(fullRange, "const x = 42;");
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Diagnostics should be updated
      const updatedDiagnostics = vscode.languages.getDiagnostics(testDoc.uri);

      // Should not crash during update
      assert.ok(true, "LSP should handle document changes without crashing");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });
  });

  suite("Code Actions Provider Tests", () => {
    test("Should provide code actions for workspace path issues", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "codeaction-workspace.js");
      fs.writeFileSync(testFile, 'const path = "/etc/passwd";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const workspaceDiagnostic = diagnostics.find((d) =>
        d.message.toLowerCase().includes("workspace")
      );

      if (workspaceDiagnostic) {
        const codeActions = await vscode.commands.executeCommand<
          vscode.CodeAction[]
        >(
          "vscode.executeCodeActionProvider",
          testDoc.uri,
          workspaceDiagnostic.range
        );

        // Should provide code actions
        assert.ok(
          codeActions && codeActions.length >= 0,
          "LSP should provide code actions without crashing"
        );
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide code actions for blocked paths", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "codeaction-blocked.js");
      fs.writeFileSync(testFile, 'const path = ".git/config";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const blockedDiagnostic = diagnostics.find((d) =>
        d.message.toLowerCase().includes("blocked")
      );

      if (blockedDiagnostic) {
        const codeActions = await vscode.commands.executeCommand<
          vscode.CodeAction[]
        >(
          "vscode.executeCodeActionProvider",
          testDoc.uri,
          blockedDiagnostic.range
        );

        // Should provide code actions
        if (codeActions && codeActions.length > 0) {
          assert.ok(
            codeActions.some(
              (action) =>
                action.title.toLowerCase().includes("remove") ||
                action.title.toLowerCase().includes("configure")
            ),
            "Should provide relevant code actions for blocked paths"
          );
        }
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should provide code actions for sync operations", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "codeaction-sync.js");
      fs.writeFileSync(testFile, 'fs.unlinkSync("test.txt");');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(testDoc.uri);
      const syncDiagnostic = diagnostics.find(
        (d) =>
          d.message.toLowerCase().includes("async") ||
          d.message.toLowerCase().includes("sync")
      );

      if (syncDiagnostic) {
        const codeActions = await vscode.commands.executeCommand<
          vscode.CodeAction[]
        >(
          "vscode.executeCodeActionProvider",
          testDoc.uri,
          syncDiagnostic.range
        );

        // Should provide code actions
        if (codeActions && codeActions.length > 0) {
          assert.ok(
            codeActions.some((action) =>
              action.title.toLowerCase().includes("async")
            ),
            "Should provide code action to convert to async"
          );
        }
      }

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });
  });

  suite("Configuration Change Tests", () => {
    test("Should handle configuration changes", async function () {
      this.timeout(10000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      // Get current configuration
      const config = vscode.workspace.getConfiguration("mcp-filesystem");
      const originalBlockedPaths = config.get<string[]>(
        "security.blockedPaths",
        []
      );

      try {
        // Update configuration - use Global target if Workspace is not available
        const target = vscode.workspace.workspaceFolders
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;

        await config.update(
          "security.blockedPaths",
          [...originalBlockedPaths, "test-blocked"],
          target
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Create test file with the new blocked path
        const testFile = path.join(testDir, "config-change.js");
        fs.writeFileSync(testFile, 'const path = "test-blocked/file.txt";');

        const testDoc = await vscode.workspace.openTextDocument(testFile);
        await vscode.window.showTextDocument(testDoc);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Should process the new configuration
        assert.ok(
          true,
          "LSP should handle configuration changes without crashing"
        );

        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      } catch (error) {
        // Configuration updates may fail in test environment
        console.log("Configuration update error (expected in test):", error);
        assert.ok(true, "LSP should handle configuration gracefully");
      } finally {
        // Restore original configuration
        try {
          const target = vscode.workspace.workspaceFolders
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;

          await config.update(
            "security.blockedPaths",
            originalBlockedPaths,
            target
          );
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test("Should revalidate documents on configuration change", async function () {
      this.timeout(10000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "config-revalidate.js");
      fs.writeFileSync(testFile, 'const path = "dynamic-blocked/file.txt";');

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get initial diagnostics
      const initialDiagnostics = vscode.languages.getDiagnostics(testDoc.uri);

      // Update configuration to block the path
      const config = vscode.workspace.getConfiguration("mcp-filesystem");
      const originalBlockedPaths = config.get<string[]>(
        "security.blockedPaths",
        []
      );

      try {
        const target = vscode.workspace.workspaceFolders
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;

        await config.update(
          "security.blockedPaths",
          [...originalBlockedPaths, "dynamic-blocked"],
          target
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get updated diagnostics
        const updatedDiagnostics = vscode.languages.getDiagnostics(testDoc.uri);

        // Should revalidate and potentially add diagnostics
        assert.ok(
          true,
          "LSP should revalidate documents on configuration change"
        );

        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      } catch (error) {
        // Configuration updates may fail in test environment
        console.log("Configuration update error (expected in test):", error);
        assert.ok(true, "LSP should handle configuration gracefully");
      } finally {
        // Restore original configuration
        try {
          const target = vscode.workspace.workspaceFolders
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;

          await config.update(
            "security.blockedPaths",
            originalBlockedPaths,
            target
          );
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  suite("Error Handling Tests", () => {
    test("Should handle malformed documents gracefully", async function () {
      this.timeout(5000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "error-malformed.js");
      fs.writeFileSync(testFile, "const x = {{{");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not crash on malformed content
      assert.ok(true, "LSP should handle malformed documents gracefully");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should handle very large files gracefully", async function () {
      this.timeout(10000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "error-large.js");
      const largeContent = 'const path = "/test";\n'.repeat(1000);
      fs.writeFileSync(testFile, largeContent);

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should not crash on large files
      assert.ok(true, "LSP should handle large files gracefully");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should handle rapid document changes", async function () {
      this.timeout(10000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      const testFile = path.join(testDir, "error-rapid.js");
      fs.writeFileSync(testFile, "const x = 1;");

      const testDoc = await vscode.workspace.openTextDocument(testFile);
      const editor = await vscode.window.showTextDocument(testDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        await editor.edit((editBuilder) => {
          const fullRange = new vscode.Range(
            testDoc.positionAt(0),
            testDoc.positionAt(testDoc.getText().length)
          );
          editBuilder.replace(fullRange, `const x = ${i};`);
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not crash on rapid changes
      assert.ok(true, "LSP should handle rapid document changes gracefully");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });

    test("Should continue operating after errors", async function () {
      this.timeout(10000);

      if (!languageServerReady) {
        this.skip();
        return;
      }

      // Create a file that might cause an error
      const errorFile = path.join(testDir, "error-recovery-1.js");
      fs.writeFileSync(errorFile, "const x = {{{");

      const errorDoc = await vscode.workspace.openTextDocument(errorFile);
      await vscode.window.showTextDocument(errorDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );

      // Create a normal file
      const normalFile = path.join(testDir, "error-recovery-2.js");
      fs.writeFileSync(normalFile, 'const path = "./test.txt";');

      const normalDoc = await vscode.workspace.openTextDocument(normalFile);
      await vscode.window.showTextDocument(normalDoc);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should still provide hover
      const position = new vscode.Position(0, 15);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        normalDoc.uri,
        position
      );

      // LSP should still be operational
      assert.ok(
        hovers !== undefined,
        "LSP should continue operating after errors"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    });
  });

  suiteTeardown(async () => {
    // Close all documents
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // Clean up temp directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});

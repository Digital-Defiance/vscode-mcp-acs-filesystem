import * as assert from "assert";
import * as vscode from "vscode";
import { OperationsTreeDataProvider } from "../../operationsTreeProvider";
import { MCPFilesystemClient } from "../../mcpClient";
import { SettingsManager } from "../../settingsManager";
import { ErrorHandler } from "../../errorHandling";

suite("Operations Tree Provider Test Suite", () => {
  let provider: OperationsTreeDataProvider;
  let outputChannel: vscode.LogOutputChannel;
  let mockClient: MCPFilesystemClient;
  let settingsManager: SettingsManager;
  let errorHandler: ErrorHandler;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel("Test Operations Tree", {
      log: true,
    });
    settingsManager = new SettingsManager();
    errorHandler = new ErrorHandler(outputChannel);
    provider = new OperationsTreeDataProvider();
    mockClient = new MCPFilesystemClient(outputChannel);
  });

  teardown(() => {
    if (provider) {
      provider.dispose();
    }
    if (mockClient) {
      mockClient.stop();
    }
    outputChannel.dispose();
  });

  test("Provider should be instantiable", () => {
    assert.ok(provider);
    assert.ok(provider instanceof OperationsTreeDataProvider);
  });

  test("Provider should implement TreeDataProvider interface", () => {
    assert.ok(typeof provider.getTreeItem === "function");
    assert.ok(typeof provider.getChildren === "function");
    assert.ok(provider.onDidChangeTreeData !== undefined);
  });

  test("Provider should have setMCPClient method", () => {
    assert.ok(typeof provider.setMCPClient === "function");
  });

  test("Provider should have refresh method", () => {
    assert.ok(typeof provider.refresh === "function");
  });

  test("setMCPClient should accept client", () => {
    assert.doesNotThrow(() => {
      provider.setMCPClient(mockClient);
    });
  });

  test("setMCPClient should accept undefined", () => {
    assert.doesNotThrow(() => {
      provider.setMCPClient(undefined);
    });
  });

  test("getChildren should return root items", async () => {
    const children = await provider.getChildren();
    assert.ok(Array.isArray(children));
    assert.ok(children.length >= 1);
  });

  test("getChildren should include Quick Actions", async () => {
    provider.setMCPClient(mockClient);
    const children = await provider.getChildren();
    const quickActions = children.find(
      (item) => item.label === "Quick Actions"
    );
    assert.ok(quickActions);
  });

  test("Quick Actions should have child items", async () => {
    provider.setMCPClient(mockClient);
    const rootChildren = await provider.getChildren();
    const quickActions = rootChildren.find(
      (item) => item.label === "Quick Actions"
    );
    assert.ok(quickActions);
    const children = await provider.getChildren(quickActions as any);
    assert.ok(Array.isArray(children));
    assert.ok(children.length > 0);
  });

  test("Quick Actions should include all operations", async () => {
    provider.setMCPClient(mockClient);
    const rootChildren = await provider.getChildren();
    const quickActions = rootChildren.find(
      (item) => item.label === "Quick Actions"
    );
    const children = await provider.getChildren(quickActions as any);
    const labels = children.map((item) => item.label);
    assert.ok(labels.includes("Batch Operations"));
    assert.ok(labels.includes("Watch Directory"));
    assert.ok(labels.includes("Search Files"));
  });

  test("Watch Sessions should display when sessions exist", async () => {
    provider.setMCPClient(mockClient);
    mockClient.recordWatchSession("/test/path", true, ["*.ts"]);
    const children = await provider.getChildren();
    const watchSessions = children.find(
      (item) => item.label === "Active Watch Sessions"
    );
    assert.ok(watchSessions);
  });

  test("Recent Operations should display when operations exist", async () => {
    provider.setMCPClient(mockClient);
    mockClient.recordBatchOperation([
      { type: "copy", source: "/a", destination: "/b" },
    ]);
    const children = await provider.getChildren();
    const recentOps = children.find(
      (item) => item.label === "Recent Operations"
    );
    assert.ok(recentOps);
  });

  test("refresh should fire onDidChangeTreeData event", (done) => {
    provider.onDidChangeTreeData(() => {
      done();
    });
    provider.refresh();
  });

  suite("Settings Manager Integration", () => {
    test("Provider should accept settings manager in constructor", () => {
      const providerWithSettings = new OperationsTreeDataProvider(
        settingsManager
      );
      assert.ok(providerWithSettings);
      providerWithSettings.dispose();
    });

    test("Provider should accept both settings manager and error handler", () => {
      const providerWithBoth = new OperationsTreeDataProvider(
        settingsManager,
        errorHandler
      );
      assert.ok(providerWithBoth);
      providerWithBoth.dispose();
    });

    test("Provider should refresh on settings change", (done) => {
      const providerWithSettings = new OperationsTreeDataProvider(
        settingsManager
      );

      providerWithSettings.onDidChangeTreeData(() => {
        providerWithSettings.dispose();
        done();
      });

      // Trigger settings change
      settingsManager.reload();
    });

    test("Provider should unsubscribe from settings on dispose", () => {
      const providerWithSettings = new OperationsTreeDataProvider(
        settingsManager
      );

      providerWithSettings.dispose();

      // After dispose, settings changes should not affect the provider
      assert.doesNotThrow(() => {
        settingsManager.reload();
      });
    });

    test("Provider should work without settings manager", async () => {
      const providerWithoutSettings = new OperationsTreeDataProvider();
      const children = await providerWithoutSettings.getChildren();
      assert.ok(Array.isArray(children));
      providerWithoutSettings.dispose();
    });
  });

  suite("Error Handler Integration", () => {
    test("Provider should accept error handler in constructor", () => {
      const providerWithErrors = new OperationsTreeDataProvider(
        undefined,
        errorHandler
      );
      assert.ok(providerWithErrors);
      providerWithErrors.dispose();
    });

    test("Provider should handle errors when getting children", async () => {
      const providerWithErrors = new OperationsTreeDataProvider(
        undefined,
        errorHandler
      );

      // Should not throw even if there are errors
      const children = await providerWithErrors.getChildren();
      assert.ok(Array.isArray(children));
      providerWithErrors.dispose();
    });

    test("Provider should handle errors when loading watch sessions", async () => {
      const providerWithErrors = new OperationsTreeDataProvider(
        undefined,
        errorHandler
      );
      providerWithErrors.setMCPClient(mockClient);

      // Create a watch session
      mockClient.recordWatchSession("/test", true);

      const rootChildren = await providerWithErrors.getChildren();
      const watchSessions = rootChildren.find(
        (item) => item.label === "Active Watch Sessions"
      );

      // Should handle gracefully
      if (watchSessions) {
        const children = await providerWithErrors.getChildren(
          watchSessions as any
        );
        assert.ok(Array.isArray(children));
      }

      providerWithErrors.dispose();
    });

    test("Provider should handle errors when loading recent operations", async () => {
      const providerWithErrors = new OperationsTreeDataProvider(
        undefined,
        errorHandler
      );
      providerWithErrors.setMCPClient(mockClient);

      // Create an operation
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      const rootChildren = await providerWithErrors.getChildren();
      const recentOps = rootChildren.find(
        (item) => item.label === "Recent Operations"
      );

      // Should handle gracefully
      if (recentOps) {
        const children = await providerWithErrors.getChildren(recentOps as any);
        assert.ok(Array.isArray(children));
      }

      providerWithErrors.dispose();
    });

    test("Provider should work without error handler", async () => {
      const providerWithoutErrors = new OperationsTreeDataProvider();
      providerWithoutErrors.setMCPClient(mockClient);

      const children = await providerWithoutErrors.getChildren();
      assert.ok(Array.isArray(children));
      providerWithoutErrors.dispose();
    });
  });

  suite("All Operation Types", () => {
    test("Quick Actions should include Batch Operations", async () => {
      provider.setMCPClient(mockClient);
      const rootChildren = await provider.getChildren();
      const quickActions = rootChildren.find(
        (item) => item.label === "Quick Actions"
      );
      const children = await provider.getChildren(quickActions as any);
      const batchOp = children.find(
        (item) => item.label === "Batch Operations"
      );
      assert.ok(batchOp);
      assert.strictEqual(
        batchOp.description,
        "Execute multiple file operations"
      );
    });

    test("Quick Actions should include Watch Directory", async () => {
      provider.setMCPClient(mockClient);
      const rootChildren = await provider.getChildren();
      const quickActions = rootChildren.find(
        (item) => item.label === "Quick Actions"
      );
      const children = await provider.getChildren(quickActions as any);
      const watchOp = children.find((item) => item.label === "Watch Directory");
      assert.ok(watchOp);
      assert.strictEqual(watchOp.description, "Monitor directory for changes");
    });

    test("Quick Actions should include Search Files", async () => {
      provider.setMCPClient(mockClient);
      const rootChildren = await provider.getChildren();
      const quickActions = rootChildren.find(
        (item) => item.label === "Quick Actions"
      );
      const children = await provider.getChildren(quickActions as any);
      const searchOp = children.find((item) => item.label === "Search Files");
      assert.ok(searchOp);
      assert.strictEqual(searchOp.description, "Search by name or content");
    });

    test("Quick Actions should include Compute Checksum", async () => {
      provider.setMCPClient(mockClient);
      const rootChildren = await provider.getChildren();
      const quickActions = rootChildren.find(
        (item) => item.label === "Quick Actions"
      );
      const children = await provider.getChildren(quickActions as any);
      const checksumOp = children.find(
        (item) => item.label === "Compute Checksum"
      );
      assert.ok(checksumOp);
      assert.strictEqual(checksumOp.description, "Verify file integrity");
    });

    test("Quick Actions should include Analyze Disk Usage", async () => {
      provider.setMCPClient(mockClient);
      const rootChildren = await provider.getChildren();
      const quickActions = rootChildren.find(
        (item) => item.label === "Quick Actions"
      );
      const children = await provider.getChildren(quickActions as any);
      const diskOp = children.find(
        (item) => item.label === "Analyze Disk Usage"
      );
      assert.ok(diskOp);
      assert.strictEqual(diskOp.description, "View directory sizes");
    });

    test("Watch sessions should display with correct details", async () => {
      provider.setMCPClient(mockClient);
      mockClient.recordWatchSession("/test/path", true, ["*.ts", "*.js"]);

      const rootChildren = await provider.getChildren();
      const watchSessions = rootChildren.find(
        (item) => item.label === "Active Watch Sessions"
      );
      assert.ok(watchSessions);

      const children = await provider.getChildren(watchSessions as any);
      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0].label, "/test/path");
      assert.ok(children[0].description.includes("events"));
    });

    test("Recent operations should display with correct details", async () => {
      provider.setMCPClient(mockClient);
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      mockClient.recordSearchOperation("*.ts");
      mockClient.recordChecksumOperation("/file.txt");

      const rootChildren = await provider.getChildren();
      const recentOps = rootChildren.find(
        (item) => item.label === "Recent Operations"
      );
      assert.ok(recentOps);

      const children = await provider.getChildren(recentOps as any);
      assert.ok(children.length >= 3);
    });

    test("Operation items should have correct status icons", async () => {
      provider.setMCPClient(mockClient);
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      const rootChildren = await provider.getChildren();
      const recentOps = rootChildren.find(
        (item) => item.label === "Recent Operations"
      );
      const children = await provider.getChildren(recentOps as any);

      // Check that items have icons
      children.forEach((child) => {
        assert.ok(child.iconPath);
      });
    });

    test("Watch session items should have context value", async () => {
      provider.setMCPClient(mockClient);
      mockClient.recordWatchSession("/test", false);

      const rootChildren = await provider.getChildren();
      const watchSessions = rootChildren.find(
        (item) => item.label === "Active Watch Sessions"
      );
      const children = await provider.getChildren(watchSessions as any);

      assert.strictEqual(children[0].contextValue, "watchSession");
    });

    test("Operation items should have context value", async () => {
      provider.setMCPClient(mockClient);
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      const rootChildren = await provider.getChildren();
      const recentOps = rootChildren.find(
        (item) => item.label === "Recent Operations"
      );
      const children = await provider.getChildren(recentOps as any);

      assert.strictEqual(children[0].contextValue, "operation");
    });
  });

  suite("Refresh Scenarios", () => {
    test("Refresh should update tree when client is set", (done) => {
      provider.onDidChangeTreeData(() => {
        done();
      });
      provider.setMCPClient(mockClient);
    });

    test("Refresh should update tree when operations are added", async () => {
      provider.setMCPClient(mockClient);

      // Initial state
      let children = await provider.getChildren();
      const initialCount = children.length;

      // Add operation
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      // Refresh
      provider.refresh();

      // Should show recent operations now
      children = await provider.getChildren();
      const recentOps = children.find(
        (item) => item.label === "Recent Operations"
      );
      assert.ok(recentOps);
    });

    test("Refresh should update tree when watch sessions are added", async () => {
      provider.setMCPClient(mockClient);

      // Initial state
      let children = await provider.getChildren();

      // Add watch session
      mockClient.recordWatchSession("/test", true);

      // Refresh
      provider.refresh();

      // Should show watch sessions now
      children = await provider.getChildren();
      const watchSessions = children.find(
        (item) => item.label === "Active Watch Sessions"
      );
      assert.ok(watchSessions);
    });

    test("Refresh should update tree when watch sessions are removed", async () => {
      provider.setMCPClient(mockClient);

      // Add and then remove watch session
      const sessionId = mockClient.recordWatchSession("/test", true);
      provider.refresh();

      let children = await provider.getChildren();
      let watchSessions = children.find(
        (item) => item.label === "Active Watch Sessions"
      );
      assert.ok(watchSessions);

      // Remove session
      mockClient.stopWatch(sessionId);
      provider.refresh();

      // Should not show watch sessions anymore
      children = await provider.getChildren();
      watchSessions = children.find(
        (item) => item.label === "Active Watch Sessions"
      );
      assert.ok(!watchSessions);
    });

    test("Refresh should update tree when operations are cleared", async () => {
      provider.setMCPClient(mockClient);

      // Add operations
      mockClient.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      provider.refresh();

      let children = await provider.getChildren();
      let recentOps = children.find(
        (item) => item.label === "Recent Operations"
      );
      assert.ok(recentOps);

      // Clear operations
      mockClient.clearOperations();
      provider.refresh();

      // Should not show recent operations anymore
      children = await provider.getChildren();
      recentOps = children.find((item) => item.label === "Recent Operations");
      assert.ok(!recentOps);
    });

    test("Refresh should be called multiple times without errors", () => {
      provider.setMCPClient(mockClient);

      assert.doesNotThrow(() => {
        for (let i = 0; i < 10; i++) {
          provider.refresh();
        }
      });
    });

    test("Refresh should work without client set", () => {
      assert.doesNotThrow(() => {
        provider.refresh();
      });
    });

    test("Refresh should work after client is unset", () => {
      provider.setMCPClient(mockClient);
      provider.setMCPClient(undefined);

      assert.doesNotThrow(() => {
        provider.refresh();
      });
    });
  });
});

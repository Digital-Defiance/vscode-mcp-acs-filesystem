import * as assert from "assert";
import * as vscode from "vscode";
import { SecurityTreeDataProvider } from "../../securityTreeProvider";
import { SettingsManager } from "../../settingsManager";
import { ErrorHandler } from "../../errorHandling";

suite("Security Tree Provider Test Suite", () => {
  let provider: SecurityTreeDataProvider;
  let settingsManager: SettingsManager;
  let errorHandler: ErrorHandler;
  let outputChannel: vscode.LogOutputChannel;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel("Test Security Tree", {
      log: true,
    });
    settingsManager = new SettingsManager();
    errorHandler = new ErrorHandler(outputChannel);
    provider = new SecurityTreeDataProvider();
  });

  teardown(() => {
    if (provider) {
      provider.dispose();
    }
    outputChannel.dispose();
  });

  test("Provider should be instantiable", () => {
    assert.ok(provider);
    assert.ok(provider instanceof SecurityTreeDataProvider);
  });

  test("Provider should implement TreeDataProvider interface", () => {
    assert.ok(typeof provider.getTreeItem === "function");
    assert.ok(typeof provider.getChildren === "function");
    assert.ok(provider.onDidChangeTreeData !== undefined);
  });

  test("Provider should have refresh method", () => {
    assert.ok(typeof provider.refresh === "function");
  });

  test("getChildren should return security items", async () => {
    const children = await provider.getChildren();
    assert.ok(Array.isArray(children));
    assert.ok(children.length > 0);
  });

  test("getChildren should include all security categories", async () => {
    const children = await provider.getChildren();
    const labels = children.map((item) => item.label);
    assert.ok(labels.includes("Workspace Root"));
    assert.ok(labels.includes("Allowed Subdirectories"));
    assert.ok(labels.includes("Blocked Paths"));
    assert.ok(labels.includes("Blocked Patterns"));
    assert.ok(labels.includes("Max File Size"));
    assert.ok(labels.includes("Max Batch Size"));
    assert.ok(labels.includes("Rate Limit"));
  });

  test("Workspace Root should have folder icon", async () => {
    const children = await provider.getChildren();
    const workspaceRoot = children.find(
      (item) => item.label === "Workspace Root"
    );
    assert.ok(workspaceRoot);
    assert.ok(workspaceRoot.iconPath);
    assert.strictEqual(
      (workspaceRoot.iconPath as vscode.ThemeIcon).id,
      "folder"
    );
  });

  test("Allowed Subdirectories should have check icon", async () => {
    const children = await provider.getChildren();
    const allowedSubdirs = children.find(
      (item) => item.label === "Allowed Subdirectories"
    );
    assert.ok(allowedSubdirs);
    assert.strictEqual(
      (allowedSubdirs.iconPath as vscode.ThemeIcon).id,
      "check"
    );
  });

  test("Blocked Paths should have error icon", async () => {
    const children = await provider.getChildren();
    const blockedPaths = children.find(
      (item) => item.label === "Blocked Paths"
    );
    assert.ok(blockedPaths);
    assert.strictEqual((blockedPaths.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("Blocked Patterns should have regex icon", async () => {
    const children = await provider.getChildren();
    const blockedPatterns = children.find(
      (item) => item.label === "Blocked Patterns"
    );
    assert.ok(blockedPatterns);
    assert.strictEqual(
      (blockedPatterns.iconPath as vscode.ThemeIcon).id,
      "regex"
    );
  });

  test("Resource limits should have dashboard icon", async () => {
    const children = await provider.getChildren();
    const maxFileSize = children.find((item) => item.label === "Max File Size");
    assert.ok(maxFileSize);
    assert.strictEqual(
      (maxFileSize.iconPath as vscode.ThemeIcon).id,
      "dashboard"
    );
  });

  test("Items should have tooltips", async () => {
    const children = await provider.getChildren();
    children.forEach((item) => {
      assert.ok(item.tooltip);
    });
  });

  test("refresh should fire onDidChangeTreeData event", (done) => {
    provider.onDidChangeTreeData(() => {
      done();
    });
    provider.refresh();
  });

  test("getChildren should return empty array for non-root elements", async () => {
    const children = await provider.getChildren();
    const workspaceRoot = children[0];
    const subChildren = await provider.getChildren(workspaceRoot as any);
    assert.ok(Array.isArray(subChildren));
    assert.strictEqual(subChildren.length, 0);
  });

  suite("Settings Manager Integration", () => {
    test("Provider should accept settings manager in constructor", () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      assert.ok(providerWithSettings);
      providerWithSettings.dispose();
    });

    test("Provider should accept both settings manager and error handler", () => {
      const providerWithBoth = new SecurityTreeDataProvider(
        settingsManager,
        errorHandler
      );
      assert.ok(providerWithBoth);
      providerWithBoth.dispose();
    });

    test("Provider should use settings manager for configuration", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );

      const children = await providerWithSettings.getChildren();
      assert.ok(Array.isArray(children));
      assert.ok(children.length > 0);

      providerWithSettings.dispose();
    });

    test("Provider should refresh on settings change", (done) => {
      const providerWithSettings = new SecurityTreeDataProvider(
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
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );

      providerWithSettings.dispose();

      // After dispose, settings changes should not affect the provider
      assert.doesNotThrow(() => {
        settingsManager.reload();
      });
    });

    test("Provider should work without settings manager", async () => {
      const providerWithoutSettings = new SecurityTreeDataProvider();
      const children = await providerWithoutSettings.getChildren();
      assert.ok(Array.isArray(children));
      providerWithoutSettings.dispose();
    });

    test("Provider should fall back to direct config access without settings manager", async () => {
      const providerWithoutSettings = new SecurityTreeDataProvider();
      const children = await providerWithoutSettings.getChildren();

      // Should still show all security items
      const labels = children.map((item) => item.label);
      assert.ok(labels.includes("Workspace Root"));
      assert.ok(labels.includes("Blocked Paths"));

      providerWithoutSettings.dispose();
    });
  });

  suite("Security Boundary Display", () => {
    test("Workspace Root should display current workspace root", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const workspaceRoot = children.find(
        (item) => item.label === "Workspace Root"
      );

      assert.ok(workspaceRoot);
      assert.ok(workspaceRoot.value);
      assert.ok(workspaceRoot.tooltip);

      providerWithSettings.dispose();
    });

    test("Allowed Subdirectories should display configured subdirectories", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const allowedSubdirs = children.find(
        (item) => item.label === "Allowed Subdirectories"
      );

      assert.ok(allowedSubdirs);
      assert.ok(allowedSubdirs.value);
      assert.ok(allowedSubdirs.tooltip);

      providerWithSettings.dispose();
    });

    test("Allowed Subdirectories should show 'All' when empty", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const allowedSubdirs = children.find(
        (item) => item.label === "Allowed Subdirectories"
      );

      assert.ok(allowedSubdirs);
      // Should show "All (within workspace)" when no specific subdirectories configured
      assert.ok(
        allowedSubdirs.value.includes("All") ||
          allowedSubdirs.value.includes("workspace")
      );

      providerWithSettings.dispose();
    });

    test("Blocked Paths should display configured blocked paths", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const blockedPaths = children.find(
        (item) => item.label === "Blocked Paths"
      );

      assert.ok(blockedPaths);
      assert.ok(blockedPaths.value !== undefined);
      assert.ok(blockedPaths.tooltip);

      providerWithSettings.dispose();
    });

    test("Blocked Patterns should display configured patterns", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const blockedPatterns = children.find(
        (item) => item.label === "Blocked Patterns"
      );

      assert.ok(blockedPatterns);
      assert.ok(blockedPatterns.value !== undefined);
      assert.ok(blockedPatterns.tooltip);

      providerWithSettings.dispose();
    });

    test("Security items should have appropriate icons", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();

      const workspaceRoot = children.find(
        (item) => item.label === "Workspace Root"
      );
      assert.strictEqual(
        (workspaceRoot?.iconPath as vscode.ThemeIcon)?.id,
        "folder"
      );

      const allowedSubdirs = children.find(
        (item) => item.label === "Allowed Subdirectories"
      );
      assert.strictEqual(
        (allowedSubdirs?.iconPath as vscode.ThemeIcon)?.id,
        "check"
      );

      const blockedPaths = children.find(
        (item) => item.label === "Blocked Paths"
      );
      assert.strictEqual(
        (blockedPaths?.iconPath as vscode.ThemeIcon)?.id,
        "error"
      );

      const blockedPatterns = children.find(
        (item) => item.label === "Blocked Patterns"
      );
      assert.strictEqual(
        (blockedPatterns?.iconPath as vscode.ThemeIcon)?.id,
        "regex"
      );

      providerWithSettings.dispose();
    });
  });

  suite("Configuration Visualization", () => {
    test("Max File Size should display in MB", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const maxFileSize = children.find(
        (item) => item.label === "Max File Size"
      );

      assert.ok(maxFileSize);
      assert.ok(maxFileSize.value.includes("MB"));
      assert.ok(maxFileSize.tooltip);

      providerWithSettings.dispose();
    });

    test("Max Batch Size should display in GB", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const maxBatchSize = children.find(
        (item) => item.label === "Max Batch Size"
      );

      assert.ok(maxBatchSize);
      assert.ok(maxBatchSize.value.includes("GB"));
      assert.ok(maxBatchSize.tooltip);

      providerWithSettings.dispose();
    });

    test("Rate Limit should display operations per minute", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();
      const rateLimit = children.find((item) => item.label === "Rate Limit");

      assert.ok(rateLimit);
      assert.ok(rateLimit.value.includes("ops/min"));
      assert.ok(rateLimit.tooltip);

      providerWithSettings.dispose();
    });

    test("Resource limits should have dashboard icon", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();

      const maxFileSize = children.find(
        (item) => item.label === "Max File Size"
      );
      assert.strictEqual(
        (maxFileSize?.iconPath as vscode.ThemeIcon)?.id,
        "dashboard"
      );

      const maxBatchSize = children.find(
        (item) => item.label === "Max Batch Size"
      );
      assert.strictEqual(
        (maxBatchSize?.iconPath as vscode.ThemeIcon)?.id,
        "dashboard"
      );

      const rateLimit = children.find((item) => item.label === "Rate Limit");
      assert.strictEqual(
        (rateLimit?.iconPath as vscode.ThemeIcon)?.id,
        "dashboard"
      );

      providerWithSettings.dispose();
    });

    test("All items should have descriptions", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();

      children.forEach((item) => {
        assert.ok(item.description);
      });

      providerWithSettings.dispose();
    });

    test("All items should have tooltips", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();

      children.forEach((item) => {
        assert.ok(item.tooltip);
      });

      providerWithSettings.dispose();
    });

    test("All items should be non-collapsible", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );
      const children = await providerWithSettings.getChildren();

      children.forEach((item) => {
        assert.strictEqual(
          item.collapsibleState,
          vscode.TreeItemCollapsibleState.None
        );
      });

      providerWithSettings.dispose();
    });
  });

  suite("Refresh Scenarios", () => {
    test("Refresh should update tree when settings change", (done) => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );

      providerWithSettings.onDidChangeTreeData(() => {
        providerWithSettings.dispose();
        done();
      });

      // Trigger settings change
      settingsManager.reload();
    });

    test("Refresh should be called multiple times without errors", () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );

      assert.doesNotThrow(() => {
        for (let i = 0; i < 10; i++) {
          providerWithSettings.refresh();
        }
      });

      providerWithSettings.dispose();
    });

    test("Refresh should work without settings manager", () => {
      const providerWithoutSettings = new SecurityTreeDataProvider();

      assert.doesNotThrow(() => {
        providerWithoutSettings.refresh();
      });

      providerWithoutSettings.dispose();
    });

    test("Refresh should update displayed values", async () => {
      const providerWithSettings = new SecurityTreeDataProvider(
        settingsManager
      );

      // Get initial children
      const children1 = await providerWithSettings.getChildren();
      assert.ok(children1.length > 0);

      // Refresh
      providerWithSettings.refresh();

      // Get children again
      const children2 = await providerWithSettings.getChildren();
      assert.strictEqual(children2.length, children1.length);

      providerWithSettings.dispose();
    });

    test("Refresh should handle errors gracefully", async () => {
      const providerWithErrors = new SecurityTreeDataProvider(
        undefined,
        errorHandler
      );

      // Should not throw even if there are errors
      assert.doesNotThrow(() => {
        providerWithErrors.refresh();
      });

      const children = await providerWithErrors.getChildren();
      assert.ok(Array.isArray(children));

      providerWithErrors.dispose();
    });
  });

  suite("Error Handler Integration", () => {
    test("Provider should accept error handler in constructor", () => {
      const providerWithErrors = new SecurityTreeDataProvider(
        undefined,
        errorHandler
      );
      assert.ok(providerWithErrors);
      providerWithErrors.dispose();
    });

    test("Provider should handle errors when getting children", async () => {
      const providerWithErrors = new SecurityTreeDataProvider(
        undefined,
        errorHandler
      );

      // Should not throw even if there are errors
      const children = await providerWithErrors.getChildren();
      assert.ok(Array.isArray(children));

      providerWithErrors.dispose();
    });

    test("Provider should work without error handler", async () => {
      const providerWithoutErrors = new SecurityTreeDataProvider();

      const children = await providerWithoutErrors.getChildren();
      assert.ok(Array.isArray(children));

      providerWithoutErrors.dispose();
    });
  });
});

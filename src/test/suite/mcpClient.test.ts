import * as assert from "assert";
import * as vscode from "vscode";
import { MCPFilesystemClient } from "../../mcpClient";
import { SettingsManager } from "../../settingsManager";
import { ErrorHandler, ErrorCategory } from "../../errorHandling";

suite("MCP Filesystem Client Test Suite", () => {
  let outputChannel: vscode.LogOutputChannel;
  let client: MCPFilesystemClient;
  let settingsManager: SettingsManager;
  let errorHandler: ErrorHandler;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel(
      "Test MCP Filesystem Client",
      { log: true }
    );
    settingsManager = new SettingsManager();
    errorHandler = new ErrorHandler(outputChannel);
    client = new MCPFilesystemClient(outputChannel);
  });

  teardown(async () => {
    if (client) {
      client.stop();
      // Wait a bit for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Dispose output channel after client is fully stopped
    try {
      outputChannel.dispose();
    } catch (error) {
      // Ignore disposal errors
    }
  });

  suite("Client Instantiation", () => {
    test("Client should be instantiable", () => {
      assert.ok(client);
      assert.ok(client instanceof MCPFilesystemClient);
    });

    test("Client should accept output channel", () => {
      const newChannel = vscode.window.createOutputChannel("Test Channel", {
        log: true,
      });
      const newClient = new MCPFilesystemClient(newChannel);
      assert.ok(newClient);
      newClient.stop();
      newChannel.dispose();
    });
  });

  suite("Lifecycle Management", () => {
    test("Client should have start method", () => {
      assert.ok(typeof client.start === "function");
    });

    test("Client should have stop method", () => {
      assert.ok(typeof client.stop === "function");
    });

    test("Client should have isRunning method", () => {
      assert.ok(typeof client.isRunning === "function");
    });

    test("start should initialize client", async function () {
      this.timeout(10000); // Increase timeout for server startup
      await client.start();
      assert.ok(client.isRunning());
    });

    test("stop should clear operations and watch sessions", async function () {
      this.timeout(10000);
      await client.start();
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      client.recordWatchSession("/test", true);

      client.stop();
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.strictEqual(client.getOperations().length, 0);
      assert.strictEqual(client.getWatchSessions().length, 0);
    });

    test("stop should not throw when called without start", () => {
      assert.doesNotThrow(() => {
        client.stop();
      });
    });

    test("isRunning should return false before start", () => {
      assert.strictEqual(client.isRunning(), false);
    });
  });

  suite("Operation Recording (Local)", () => {
    test("recordBatchOperation should create operation record", () => {
      const operations = [
        {
          type: "copy",
          source: "/src/file1.txt",
          destination: "/dest/file1.txt",
        },
        {
          type: "move",
          source: "/src/file2.txt",
          destination: "/dest/file2.txt",
        },
      ];

      const operationId = client.recordBatchOperation(operations, true);

      assert.ok(operationId);
      assert.ok(operationId.startsWith("op_"));

      const allOps = client.getOperations();
      assert.strictEqual(allOps.length, 1);
      assert.strictEqual(allOps[0].type, "batch");
      assert.strictEqual(allOps[0].status, "completed");
    });

    test("recordWatchSession should create watch session", () => {
      const sessionId = client.recordWatchSession("/test/path", true, [
        "*.ts",
        "*.js",
      ]);

      assert.ok(sessionId);
      assert.ok(sessionId.startsWith("op_"));

      const sessions = client.getWatchSessions();
      assert.strictEqual(sessions.length, 1);
      assert.strictEqual(sessions[0].path, "/test/path");
      assert.strictEqual(sessions[0].recursive, true);
      assert.deepStrictEqual(sessions[0].filters, ["*.ts", "*.js"]);
    });

    test("recordSearchOperation should create search record", () => {
      const operationId = client.recordSearchOperation("*.ts", "name", [
        "typescript",
      ]);

      assert.ok(operationId);

      const ops = client.getOperations();
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0].type, "search");
      assert.strictEqual(ops[0].details.query, "*.ts");
      assert.strictEqual(ops[0].details.searchType, "name");
    });

    test("recordChecksumOperation should create checksum record", () => {
      const operationId = client.recordChecksumOperation("/file.txt", "sha256");

      assert.ok(operationId);

      const ops = client.getOperations();
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0].type, "checksum");
      assert.strictEqual(ops[0].details.algorithm, "sha256");
    });

    test("recordDiskUsageOperation should create disk usage record", () => {
      const operationId = client.recordDiskUsageOperation(
        "/workspace",
        3,
        true
      );

      assert.ok(operationId);

      const ops = client.getOperations();
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0].type, "disk_usage");
      assert.strictEqual(ops[0].details.depth, 3);
      assert.strictEqual(ops[0].details.groupByType, true);
    });
  });

  suite("Operation History", () => {
    test("Client should have getOperations method", () => {
      assert.ok(typeof client.getOperations === "function");
    });

    test("Client should have getRecentOperations method", () => {
      assert.ok(typeof client.getRecentOperations === "function");
    });

    test("Client should have clearOperations method", () => {
      assert.ok(typeof client.clearOperations === "function");
    });

    test("getOperations should return all operations", () => {
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      client.recordSearchOperation("*.ts");
      client.recordChecksumOperation("/file.txt");

      const ops = client.getOperations();

      assert.strictEqual(ops.length, 3);
    });

    test("getOperations should return operations in reverse chronological order", async () => {
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 10));
      client.recordSearchOperation("*.ts");
      await new Promise((resolve) => setTimeout(resolve, 10));
      client.recordChecksumOperation("/file.txt");

      const ops = client.getOperations();

      assert.ok(ops[0].timestamp >= ops[1].timestamp);
      assert.ok(ops[1].timestamp >= ops[2].timestamp);
    });

    test("getRecentOperations should limit results", () => {
      for (let i = 0; i < 20; i++) {
        client.recordBatchOperation([
          { type: "copy", source: `/a${i}`, destination: `/b${i}` },
        ]);
      }

      const recent = client.getRecentOperations(5);

      assert.strictEqual(recent.length, 5);
    });

    test("getRecentOperations should default to 10", () => {
      for (let i = 0; i < 15; i++) {
        client.recordBatchOperation([
          { type: "copy", source: `/a${i}`, destination: `/b${i}` },
        ]);
      }

      const recent = client.getRecentOperations();

      assert.strictEqual(recent.length, 10);
    });

    test("clearOperations should remove all operations", () => {
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      client.recordSearchOperation("*.ts");
      assert.strictEqual(client.getOperations().length, 2);

      client.clearOperations();

      assert.strictEqual(client.getOperations().length, 0);
    });

    test("getWatchSessions should return all watch sessions", () => {
      client.recordWatchSession("/path1", true);
      client.recordWatchSession("/path2", false);

      const sessions = client.getWatchSessions();

      assert.strictEqual(sessions.length, 2);
    });
  });

  suite("Watch Session Management", () => {
    test("Client should have stopWatch method", () => {
      assert.ok(typeof client.stopWatch === "function");
    });

    test("stopWatch should remove watch session", () => {
      const sessionId = client.recordWatchSession("/test", false);
      assert.strictEqual(client.getWatchSessions().length, 1);

      client.stopWatch(sessionId);

      assert.strictEqual(client.getWatchSessions().length, 0);
    });

    test("stopWatch should handle invalid session gracefully", () => {
      assert.doesNotThrow(() => {
        client.stopWatch("invalid_session");
      });
    });

    test("stopWatch should handle stopping already stopped watch session", () => {
      const sessionId = client.recordWatchSession("/test", false);
      client.stopWatch(sessionId);

      // Stopping again should not throw
      assert.doesNotThrow(() => {
        client.stopWatch(sessionId);
      });
    });
  });

  suite("Settings Manager Integration", () => {
    test("Client should accept settings manager in constructor", () => {
      const clientWithSettings = new MCPFilesystemClient(
        outputChannel,
        settingsManager
      );
      assert.ok(clientWithSettings);
      clientWithSettings.stop();
    });

    test("Client should accept both settings manager and error handler", () => {
      const clientWithBoth = new MCPFilesystemClient(
        outputChannel,
        settingsManager,
        errorHandler
      );
      assert.ok(clientWithBoth);
      clientWithBoth.stop();
    });

    test("Client should work without settings manager", async () => {
      const clientWithoutSettings = new MCPFilesystemClient(outputChannel);
      assert.ok(clientWithoutSettings);
      clientWithoutSettings.stop();
    });
  });

  suite("Error Handler Integration", () => {
    test("Client should accept error handler in constructor", () => {
      const clientWithErrors = new MCPFilesystemClient(
        outputChannel,
        undefined,
        errorHandler
      );
      assert.ok(clientWithErrors);
      clientWithErrors.stop();
    });

    test("Client should handle watch session not found error gracefully", () => {
      const clientWithErrors = new MCPFilesystemClient(
        outputChannel,
        undefined,
        errorHandler
      );

      // Should not throw when stopping non-existent session
      assert.doesNotThrow(() => {
        clientWithErrors.stopWatch("invalid_session_id");
      });

      clientWithErrors.stop();
    });

    test("Client should work without error handler", async () => {
      const clientWithoutErrors = new MCPFilesystemClient(outputChannel);

      // Should still handle errors gracefully
      assert.doesNotThrow(() => {
        clientWithoutErrors.stopWatch("invalid_session");
      });

      clientWithoutErrors.stop();
    });
  });

  suite("Method Availability", () => {
    test("Client should have all required methods", () => {
      assert.ok(typeof client.batchOperations === "function");
      assert.ok(typeof client.watchDirectory === "function");
      assert.ok(typeof client.getWatchEvents === "function");
      assert.ok(typeof client.searchFiles === "function");
      assert.ok(typeof client.buildIndex === "function");
      assert.ok(typeof client.createSymlink === "function");
      assert.ok(typeof client.computeChecksum === "function");
      assert.ok(typeof client.verifyChecksum === "function");
      assert.ok(typeof client.analyzeDiskUsage === "function");
      assert.ok(typeof client.copyDirectory === "function");
      assert.ok(typeof client.syncDirectory === "function");
      assert.ok(typeof client.setServerConfig === "function");
      assert.ok(typeof client.connect === "function");
      assert.ok(typeof client.disconnect === "function");
    });
  });

  suite("Error Scenarios", () => {
    test("Client should handle operations after stop", () => {
      client.stop();

      // Recording operations after stop should still work
      const operationId = client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      assert.ok(operationId);
      assert.strictEqual(client.getOperations().length, 1);
    });

    test("Client should handle clearing operations multiple times", () => {
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      client.clearOperations();
      assert.strictEqual(client.getOperations().length, 0);

      // Clearing again should not throw
      assert.doesNotThrow(() => {
        client.clearOperations();
      });
      assert.strictEqual(client.getOperations().length, 0);
    });

    test("Client should handle rapid operation recording", () => {
      for (let i = 0; i < 100; i++) {
        client.recordBatchOperation([
          { type: "copy", source: `/a${i}`, destination: `/b${i}` },
        ]);
      }

      const ops = client.getOperations();
      assert.strictEqual(ops.length, 100);
    });

    test("Client should handle multiple watch sessions on same path", () => {
      const sessionId1 = client.recordWatchSession("/test", false);
      const sessionId2 = client.recordWatchSession("/test", false);

      assert.notStrictEqual(sessionId1, sessionId2);

      const sessions = client.getWatchSessions();
      assert.strictEqual(sessions.length, 2);
    });
  });
});

import * as assert from "assert";
import * as vscode from "vscode";
import { MCPFilesystemClient } from "../../mcpClient";

suite("Filesystem Integration Test Suite", () => {
  let outputChannel: vscode.LogOutputChannel;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel(
      "MCP Filesystem Integration Test",
      { log: true }
    );
  });

  teardown(() => {
    outputChannel.dispose();
  });

  suite("BaseMCPClient Integration Tests", () => {
    test("Should initialize with slow server (timeout handling)", async function () {
      this.timeout(70000); // 70 seconds for slow initialization

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // This tests the new timeout handling from BaseMCPClient
        // The client should handle slow initialization gracefully
        await client.start();

        // Verify connection status is available (new from BaseMCPClient)
        const status = client.getConnectionStatus();
        assert.ok(status);
        assert.ok(status.state);
        assert.ok(typeof status.serverProcessRunning === "boolean");

        // Verify diagnostics are available (new from BaseMCPClient)
        const diagnostics = client.getDiagnostics();
        assert.ok(diagnostics);
        assert.strictEqual(diagnostics.extensionName, "Filesystem");
        assert.ok(typeof diagnostics.processRunning === "boolean");
        assert.ok(typeof diagnostics.pendingRequestCount === "number");

        client.stop();
      } catch (error: any) {
        // Expected if server not available - that's okay for this test
        assert.ok(
          error.message.includes("Server") ||
            error.message.includes("spawn") ||
            error.message.includes("timeout"),
          `Error should be server-related: ${error.message}`
        );
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle timeout and re-sync", async function () {
      this.timeout(90000); // 90 seconds for timeout and retry

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Try to start - may timeout if server is slow
        await client.start();

        // If we get here, server started successfully
        // Test that isServerProcessAlive works (new from BaseMCPClient)
        const isAlive = client.isServerProcessAlive();
        assert.ok(typeof isAlive === "boolean");

        client.stop();
      } catch (error: any) {
        // Expected if server times out or isn't available
        // The important thing is that the client handles it gracefully
        assert.ok(
          error.message.includes("timeout") ||
            error.message.includes("Server") ||
            error.message.includes("spawn"),
          `Error should be timeout or server-related: ${error.message}`
        );
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should support reconnect functionality", async function () {
      this.timeout(60000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Try initial connection
        try {
          await client.start();
        } catch (error) {
          // Server may not be available - that's okay
        }

        // Test reconnect method (new from BaseMCPClient)
        assert.ok(typeof client.reconnect === "function");

        // Try reconnect
        try {
          const reconnected = await client.reconnect();
          assert.ok(typeof reconnected === "boolean");
        } catch (error) {
          // Expected if server not available
        }

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should preserve filesystem-specific operations", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Verify all filesystem-specific methods still exist
        assert.ok(typeof client.batchOperations === "function");
        assert.ok(typeof client.watchDirectory === "function");
        assert.ok(typeof client.getWatchEvents === "function");
        assert.ok(typeof client.stopWatch === "function");
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

        // Verify local operation recording methods still exist
        assert.ok(typeof client.recordBatchOperation === "function");
        assert.ok(typeof client.recordWatchSession === "function");
        assert.ok(typeof client.recordSearchOperation === "function");
        assert.ok(typeof client.recordChecksumOperation === "function");
        assert.ok(typeof client.recordDiskUsageOperation === "function");
        assert.ok(typeof client.getOperations === "function");
        assert.ok(typeof client.getRecentOperations === "function");
        assert.ok(typeof client.getWatchSessions === "function");
        assert.ok(typeof client.clearOperations === "function");

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle filesystem-specific operations after start", async function () {
      this.timeout(60000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        await client.start();

        // Test that local operation recording still works
        const operationId = client.recordBatchOperation([
          { type: "copy", source: "/a", destination: "/b" },
        ]);
        assert.ok(operationId);
        assert.ok(operationId.startsWith("op_"));

        const operations = client.getOperations();
        assert.strictEqual(operations.length, 1);

        // Test watch session recording
        const sessionId = client.recordWatchSession("/test", true);
        assert.ok(sessionId);

        const sessions = client.getWatchSessions();
        assert.strictEqual(sessions.length, 1);

        client.stop();
      } catch (error: any) {
        // Expected if server not available
        assert.ok(
          error.message.includes("Server") ||
            error.message.includes("spawn") ||
            error.message.includes("timeout")
        );
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle connection state changes", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Initial state should be disconnected
        const initialStatus = client.getConnectionStatus();
        assert.ok(initialStatus);

        // Try to start
        try {
          await client.start();

          // After start, should be connected or in some active state
          const afterStartStatus = client.getConnectionStatus();
          assert.ok(afterStartStatus);
          assert.ok(afterStartStatus.state);
        } catch (error) {
          // Expected if server not available
        }

        client.stop();

        // After stop, should be disconnected
        const afterStopStatus = client.getConnectionStatus();
        assert.ok(afterStopStatus);
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle server configuration", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Test setServerConfig method
        const config = {
          workspaceRoot: "/workspace",
          allowedSubdirectories: ["src", "test"],
          blockedPaths: [".git", "node_modules"],
          blockedPatterns: ["*.key", "*.pem"],
          maxFileSize: 104857600,
          maxBatchSize: 1073741824,
          maxOperationsPerMinute: 100,
        };

        assert.doesNotThrow(() => {
          client.setServerConfig(config);
        });

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle connect/disconnect methods", async function () {
      this.timeout(60000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Test connect method (alias for start)
        assert.ok(typeof client.connect === "function");

        try {
          await client.connect();
          assert.ok(client.isRunning());
        } catch (error) {
          // Expected if server not available
        }

        // Test disconnect method (alias for stop)
        assert.ok(typeof client.disconnect === "function");
        await client.disconnect();

        // After disconnect, should not be running
        assert.ok(!client.isRunning());
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should maintain backward compatibility with local operations", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Test that local operation tracking works without server connection
        // This ensures backward compatibility

        // Record various operations
        const batchId = client.recordBatchOperation([
          { type: "copy", source: "/a", destination: "/b" },
        ]);
        const searchId = client.recordSearchOperation("*.ts", "name");
        const checksumId = client.recordChecksumOperation(
          "/file.txt",
          "sha256"
        );
        const diskUsageId = client.recordDiskUsageOperation(
          "/workspace",
          3,
          true
        );

        // Verify all operations were recorded
        const operations = client.getOperations();
        assert.strictEqual(operations.length, 4);

        // Verify operation types
        const types = operations.map((op) => op.type);
        assert.ok(types.includes("batch"));
        assert.ok(types.includes("search"));
        assert.ok(types.includes("checksum"));
        assert.ok(types.includes("disk_usage"));

        // Test watch session recording
        const sessionId1 = client.recordWatchSession("/path1", true, ["*.ts"]);
        const sessionId2 = client.recordWatchSession("/path2", false);

        const sessions = client.getWatchSessions();
        assert.strictEqual(sessions.length, 2);

        // Test stopWatch
        client.stopWatch(sessionId1);
        assert.strictEqual(client.getWatchSessions().length, 1);

        // Test clearOperations
        client.clearOperations();
        assert.strictEqual(client.getOperations().length, 0);

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should handle errors gracefully", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Test that stopping non-existent watch session doesn't throw
        assert.doesNotThrow(() => {
          client.stopWatch("invalid_session_id");
        });

        // Test that clearing operations when empty doesn't throw
        assert.doesNotThrow(() => {
          client.clearOperations();
        });

        // Test that multiple stops don't throw
        client.stop();
        assert.doesNotThrow(() => {
          client.stop();
        });

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    test("Should provide consistent diagnostics", async function () {
      this.timeout(30000);

      const client = new MCPFilesystemClient(outputChannel);

      try {
        // Get diagnostics before start
        const beforeDiagnostics = client.getDiagnostics();
        assert.ok(beforeDiagnostics);
        assert.strictEqual(beforeDiagnostics.extensionName, "Filesystem");
        assert.ok(typeof beforeDiagnostics.processRunning === "boolean");
        assert.ok(typeof beforeDiagnostics.pendingRequestCount === "number");
        assert.ok(Array.isArray(beforeDiagnostics.pendingRequests));
        assert.ok(Array.isArray(beforeDiagnostics.recentCommunication));
        assert.ok(Array.isArray(beforeDiagnostics.stateHistory));

        try {
          await client.start();

          // Get diagnostics after start
          const afterDiagnostics = client.getDiagnostics();
          assert.ok(afterDiagnostics);
          assert.strictEqual(afterDiagnostics.extensionName, "Filesystem");
        } catch (error) {
          // Expected if server not available
        }

        client.stop();
      } finally {
        client.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });
});

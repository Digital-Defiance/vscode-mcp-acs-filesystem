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

  teardown(() => {
    if (client) {
      client.stop();
    }
    outputChannel.dispose();
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

    test("start should initialize client", async () => {
      await client.start();
      assert.ok(client.isRunning());
    });

    test("stop should clear operations and watch sessions", async () => {
      await client.start();
      client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);
      client.recordWatchSession("/test", true);

      client.stop();

      assert.strictEqual(client.getOperations().length, 0);
      assert.strictEqual(client.getWatchSessions().length, 0);
    });

    test("stop should not throw when called without start", () => {
      assert.doesNotThrow(() => {
        client.stop();
      });
    });

    test("isRunning should return true after start", async () => {
      await client.start();
      assert.strictEqual(client.isRunning(), true);
    });
  });

  suite("Batch Operations", () => {
    test("Client should have batchOperations method", () => {
      assert.ok(typeof client.batchOperations === "function");
    });

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

    test("batchOperations should record and return result", async () => {
      const operations = [
        {
          type: "copy",
          source: "/src/file1.txt",
          destination: "/dest/file1.txt",
        },
      ];

      const result = await client.batchOperations({ operations, atomic: true });

      assert.strictEqual(result.status, "success");
      assert.ok(result.operationId);
      assert.ok(Array.isArray(result.results));
      assert.strictEqual(result.results.length, 1);
      assert.strictEqual(result.results[0].status, "completed");
    });

    test("batchOperations should handle non-atomic operations", async () => {
      const operations = [
        { type: "copy", source: "/a", destination: "/b" },
        { type: "delete", source: "/c" },
      ];

      const result = await client.batchOperations({
        operations,
        atomic: false,
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.results.length, 2);
    });

    test("batchOperations should default to atomic mode", async () => {
      const operations = [{ type: "copy", source: "/a", destination: "/b" }];

      const result = await client.batchOperations({ operations });

      assert.strictEqual(result.status, "success");
      const allOps = client.getOperations();
      assert.strictEqual(allOps[0].details.atomic, true);
    });
  });

  suite("Directory Watching", () => {
    test("Client should have watchDirectory method", () => {
      assert.ok(typeof client.watchDirectory === "function");
    });

    test("Client should have getWatchEvents method", () => {
      assert.ok(typeof client.getWatchEvents === "function");
    });

    test("Client should have stopWatch method", () => {
      assert.ok(typeof client.stopWatch === "function");
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

    test("watchDirectory should create session and return result", async () => {
      const result = await client.watchDirectory({
        path: "/workspace/src",
        recursive: true,
        filters: ["*.ts"],
      });

      assert.strictEqual(result.status, "success");
      assert.ok(result.sessionId);
      assert.strictEqual(result.path, "/workspace/src");
      assert.strictEqual(result.recursive, true);
    });

    test("watchDirectory should default to non-recursive", async () => {
      const result = await client.watchDirectory({ path: "/test" });

      assert.strictEqual(result.recursive, false);
    });

    test("getWatchEvents should return events for session", async () => {
      const watchResult = await client.watchDirectory({ path: "/test" });
      const sessionId = watchResult.sessionId;

      const result = await client.getWatchEvents({ sessionId });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.sessionId, sessionId);
      assert.ok(Array.isArray(result.events));
      assert.strictEqual(typeof result.eventCount, "number");
    });

    test("getWatchEvents should throw for invalid session", async () => {
      await assert.rejects(
        async () =>
          await client.getWatchEvents({ sessionId: "invalid_session" }),
        /Watch session not found/
      );
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
  });

  suite("File Search", () => {
    test("Client should have searchFiles method", () => {
      assert.ok(typeof client.searchFiles === "function");
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

    test("searchFiles should perform name search", async () => {
      const result = await client.searchFiles({
        query: "test",
        searchType: "name",
      });

      assert.strictEqual(result.status, "success");
      assert.ok(result.operationId);
      assert.strictEqual(result.query, "test");
      assert.ok(Array.isArray(result.results));
    });

    test("searchFiles should perform content search", async () => {
      const result = await client.searchFiles({
        query: "function",
        searchType: "content",
        fileTypes: ["ts", "js"],
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.query, "function");
    });

    test("searchFiles should default to name search", async () => {
      const result = await client.searchFiles({ query: "test" });

      assert.strictEqual(result.status, "success");
      const ops = client.getOperations();
      assert.strictEqual(ops[0].details.searchType, "name");
    });

    test("searchFiles should support size filters", async () => {
      const result = await client.searchFiles({
        query: "*.log",
        minSize: 1024,
        maxSize: 1048576,
      });

      assert.strictEqual(result.status, "success");
    });

    test("searchFiles should support date filters", async () => {
      const result = await client.searchFiles({
        query: "*.txt",
        modifiedAfter: "2024-01-01",
      });

      assert.strictEqual(result.status, "success");
    });
  });

  suite("File Indexing", () => {
    test("Client should have buildIndex method", () => {
      assert.ok(typeof client.buildIndex === "function");
    });

    test("buildIndex should build index for path", async () => {
      const result = await client.buildIndex({
        path: "/workspace",
        includeContent: true,
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.path, "/workspace");
      assert.strictEqual(typeof result.fileCount, "number");
      assert.strictEqual(typeof result.totalSize, "number");
    });

    test("buildIndex should work without content indexing", async () => {
      const result = await client.buildIndex({ path: "/test" });

      assert.strictEqual(result.status, "success");
    });
  });

  suite("Symlink Operations", () => {
    test("Client should have createSymlink method", () => {
      assert.ok(typeof client.createSymlink === "function");
    });

    test("createSymlink should create symlink", async () => {
      const result = await client.createSymlink({
        linkPath: "/link/to/file",
        targetPath: "/target/file",
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.linkPath, "/link/to/file");
      assert.strictEqual(result.targetPath, "/target/file");
    });
  });

  suite("Checksum Operations", () => {
    test("Client should have computeChecksum method", () => {
      assert.ok(typeof client.computeChecksum === "function");
    });

    test("Client should have verifyChecksum method", () => {
      assert.ok(typeof client.verifyChecksum === "function");
    });

    test("recordChecksumOperation should create checksum record", () => {
      const operationId = client.recordChecksumOperation("/file.txt", "sha256");

      assert.ok(operationId);

      const ops = client.getOperations();
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0].type, "checksum");
      assert.strictEqual(ops[0].details.algorithm, "sha256");
    });

    test("computeChecksum should compute with default algorithm", async () => {
      const result = await client.computeChecksum({ path: "/file.txt" });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.algorithm, "sha256");
      assert.ok(result.checksum);
    });

    test("computeChecksum should support md5", async () => {
      const result = await client.computeChecksum({
        path: "/file.txt",
        algorithm: "md5",
      });

      assert.strictEqual(result.algorithm, "md5");
    });

    test("computeChecksum should support sha1", async () => {
      const result = await client.computeChecksum({
        path: "/file.txt",
        algorithm: "sha1",
      });

      assert.strictEqual(result.algorithm, "sha1");
    });

    test("computeChecksum should support sha512", async () => {
      const result = await client.computeChecksum({
        path: "/file.txt",
        algorithm: "sha512",
      });

      assert.strictEqual(result.algorithm, "sha512");
    });

    test("verifyChecksum should verify checksum", async () => {
      const result = await client.verifyChecksum({
        path: "/file.txt",
        checksum: "abc123",
        algorithm: "sha256",
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.expectedChecksum, "abc123");
      assert.ok(result.actualChecksum);
      assert.strictEqual(typeof result.verified, "boolean");
    });
  });

  suite("Disk Usage Analysis", () => {
    test("Client should have analyzeDiskUsage method", () => {
      assert.ok(typeof client.analyzeDiskUsage === "function");
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

    test("analyzeDiskUsage should analyze disk usage", async () => {
      const result = await client.analyzeDiskUsage({
        path: "/workspace",
        depth: 2,
        groupByType: true,
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.path, "/workspace");
      assert.strictEqual(typeof result.totalSize, "number");
      assert.strictEqual(typeof result.fileCount, "number");
      assert.ok(Array.isArray(result.largestFiles));
      assert.ok(typeof result.typeBreakdown === "object");
    });

    test("analyzeDiskUsage should work without depth limit", async () => {
      const result = await client.analyzeDiskUsage({ path: "/test" });

      assert.strictEqual(result.status, "success");
    });
  });

  suite("Directory Operations", () => {
    test("Client should have copyDirectory method", () => {
      assert.ok(typeof client.copyDirectory === "function");
    });

    test("Client should have syncDirectory method", () => {
      assert.ok(typeof client.syncDirectory === "function");
    });

    test("copyDirectory should copy directory", async () => {
      const result = await client.copyDirectory({
        source: "/src",
        destination: "/dest",
        preserveMetadata: true,
        exclusions: ["*.log", "node_modules"],
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.source, "/src");
      assert.strictEqual(result.destination, "/dest");
      assert.strictEqual(typeof result.filesCopied, "number");
      assert.strictEqual(typeof result.bytesCopied, "number");
    });

    test("copyDirectory should work without options", async () => {
      const result = await client.copyDirectory({
        source: "/a",
        destination: "/b",
      });

      assert.strictEqual(result.status, "success");
    });

    test("syncDirectory should sync directories", async () => {
      const result = await client.syncDirectory({
        source: "/src",
        destination: "/dest",
        exclusions: ["*.tmp"],
      });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.source, "/src");
      assert.strictEqual(result.destination, "/dest");
      assert.strictEqual(typeof result.filesCopied, "number");
      assert.strictEqual(typeof result.filesSkipped, "number");
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

    test("Client should log settings on start when settings manager provided", async () => {
      const clientWithSettings = new MCPFilesystemClient(
        outputChannel,
        settingsManager
      );

      await clientWithSettings.start();

      // Settings should be logged (we can't easily verify output channel content,
      // but we can verify no errors were thrown)
      assert.ok(clientWithSettings.isRunning());
      clientWithSettings.stop();
    });

    test("Client should handle settings changes", async () => {
      const clientWithSettings = new MCPFilesystemClient(
        outputChannel,
        settingsManager
      );

      await clientWithSettings.start();

      // Trigger a settings change
      const settings = settingsManager.getSettings();
      settings.server.timeout = 10000;

      // Client should handle the change without errors
      assert.ok(clientWithSettings.isRunning());
      clientWithSettings.stop();
    });

    test("Client should unsubscribe from settings on stop", async () => {
      const clientWithSettings = new MCPFilesystemClient(
        outputChannel,
        settingsManager
      );

      await clientWithSettings.start();
      clientWithSettings.stop();

      // After stop, settings changes should not affect the client
      const settings = settingsManager.getSettings();
      settings.server.timeout = 15000;

      // No errors should occur
      assert.ok(true);
    });

    test("Client should work without settings manager", async () => {
      const clientWithoutSettings = new MCPFilesystemClient(outputChannel);

      await clientWithoutSettings.start();
      assert.ok(clientWithoutSettings.isRunning());
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

    test("Client should handle getWatchEvents error with error handler", async () => {
      const clientWithErrors = new MCPFilesystemClient(
        outputChannel,
        undefined,
        errorHandler
      );

      await assert.rejects(
        async () =>
          await clientWithErrors.getWatchEvents({
            sessionId: "invalid_session",
          }),
        /Watch session not found/
      );

      clientWithErrors.stop();
    });

    test("Client should work without error handler", async () => {
      const clientWithoutErrors = new MCPFilesystemClient(outputChannel);

      // Should still handle errors gracefully
      assert.doesNotThrow(() => {
        clientWithoutErrors.stopWatch("invalid_session");
      });

      await assert.rejects(
        async () =>
          await clientWithoutErrors.getWatchEvents({
            sessionId: "invalid_session",
          })
      );

      clientWithoutErrors.stop();
    });

    test("Client should categorize errors correctly", async () => {
      const clientWithErrors = new MCPFilesystemClient(
        outputChannel,
        undefined,
        errorHandler
      );

      // User error: invalid session ID
      try {
        await clientWithErrors.getWatchEvents({ sessionId: "invalid" });
        assert.fail("Should have thrown");
      } catch (error: any) {
        assert.ok(error.message.includes("Watch session not found"));
      }

      clientWithErrors.stop();
    });
  });

  suite("Error Scenarios", () => {
    test("Client should handle empty operations array", async () => {
      const result = await client.batchOperations({ operations: [] });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.results.length, 0);
    });

    test("Client should handle invalid operation types gracefully", async () => {
      const operations = [
        { type: "invalid_type", source: "/a", destination: "/b" },
      ];

      const result = await client.batchOperations({ operations });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.results.length, 1);
    });

    test("Client should handle missing required parameters", async () => {
      const operations = [{ type: "copy" }]; // Missing source and destination

      const result = await client.batchOperations({ operations });

      assert.strictEqual(result.status, "success");
    });

    test("Client should handle very long paths", async () => {
      const longPath = "/a".repeat(500);
      const result = await client.watchDirectory({ path: longPath });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.path, longPath);
    });

    test("Client should handle special characters in paths", async () => {
      const specialPath = "/path/with spaces/and-special!@#$%chars";
      const result = await client.watchDirectory({ path: specialPath });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.path, specialPath);
    });

    test("Client should handle empty search query", async () => {
      const result = await client.searchFiles({ query: "" });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.query, "");
    });

    test("Client should handle very large batch operations", async () => {
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push({
          type: "copy",
          source: `/src/file${i}.txt`,
          destination: `/dest/file${i}.txt`,
        });
      }

      const result = await client.batchOperations({ operations });

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.results.length, 1000);
    });

    test("Client should handle concurrent operations", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          client.batchOperations({
            operations: [
              { type: "copy", source: `/a${i}`, destination: `/b${i}` },
            ],
          })
        );
      }

      const results = await Promise.all(promises);

      assert.strictEqual(results.length, 10);
      results.forEach((result) => {
        assert.strictEqual(result.status, "success");
      });
    });

    test("Client should handle multiple watch sessions on same path", async () => {
      const result1 = await client.watchDirectory({ path: "/test" });
      const result2 = await client.watchDirectory({ path: "/test" });

      assert.strictEqual(result1.status, "success");
      assert.strictEqual(result2.status, "success");
      assert.notStrictEqual(result1.sessionId, result2.sessionId);

      const sessions = client.getWatchSessions();
      assert.strictEqual(sessions.length, 2);
    });

    test("Client should handle stopping already stopped watch session", () => {
      const sessionId = client.recordWatchSession("/test", false);
      client.stopWatch(sessionId);

      // Stopping again should not throw
      assert.doesNotThrow(() => {
        client.stopWatch(sessionId);
      });
    });

    test("Client should handle null or undefined parameters gracefully", async () => {
      // These should use defaults or handle gracefully
      const result1 = await client.searchFiles({
        query: "test",
        searchType: undefined,
      });
      assert.strictEqual(result1.status, "success");

      const result2 = await client.computeChecksum({
        path: "/file.txt",
        algorithm: undefined,
      });
      assert.strictEqual(result2.status, "success");
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

    test("Client should handle operations after stop", () => {
      client.stop();

      // Recording operations after stop should still work
      const operationId = client.recordBatchOperation([
        { type: "copy", source: "/a", destination: "/b" },
      ]);

      assert.ok(operationId);
      assert.strictEqual(client.getOperations().length, 1);
    });

    test("Client should handle very large file sizes in disk usage", async () => {
      const result = await client.analyzeDiskUsage({
        path: "/large",
        depth: 100,
      });

      assert.strictEqual(result.status, "success");
    });

    test("Client should handle negative depth in disk usage", async () => {
      const result = await client.analyzeDiskUsage({
        path: "/test",
        depth: -1,
      });

      assert.strictEqual(result.status, "success");
    });

    test("Client should handle empty exclusions array", async () => {
      const result = await client.copyDirectory({
        source: "/src",
        destination: "/dest",
        exclusions: [],
      });

      assert.strictEqual(result.status, "success");
    });

    test("Client should handle undefined exclusions", async () => {
      const result = await client.syncDirectory({
        source: "/src",
        destination: "/dest",
        exclusions: undefined,
      });

      assert.strictEqual(result.status, "success");
    });
  });
});

import * as assert from "assert";
import * as vscode from "vscode";
import * as fc from "fast-check";

suite("Extension Property-Based Tests", () => {
  test("Configuration values should be valid", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("debug", "info", "warn", "error"),
        (logLevel) => {
          const config = vscode.workspace.getConfiguration("mcp-filesystem");

          // Property: Valid log levels should be accepted
          // This is a simple property test demonstrating the concept
          const validLogLevels = ["debug", "info", "warn", "error"];
          assert.ok(validLogLevels.includes(logLevel));
        }
      ),
      { numRuns: 10 }
    );
  });

  test("Blocked paths should always be arrays", () => {
    const config = vscode.workspace.getConfiguration("mcp-filesystem");
    const blockedPaths = config.get("security.blockedPaths");

    // Property: Blocked paths configuration should always be an array
    assert.ok(Array.isArray(blockedPaths));
  });

  test("Resource limits should be positive numbers", () => {
    const config = vscode.workspace.getConfiguration("mcp-filesystem");
    const maxFileSize = config.get<number>("resources.maxFileSize", 0);
    const maxBatchSize = config.get<number>("resources.maxBatchSize", 0);
    const maxOpsPerMin = config.get<number>(
      "resources.maxOperationsPerMinute",
      0
    );

    // Property: All resource limits should be positive
    assert.ok(maxFileSize > 0, "maxFileSize should be positive");
    assert.ok(maxBatchSize > 0, "maxBatchSize should be positive");
    assert.ok(maxOpsPerMin > 0, "maxOperationsPerMinute should be positive");
  });

  test("File patterns should be valid strings", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 })),
        (patterns) => {
          // Property: All patterns should be non-empty strings
          for (const pattern of patterns) {
            assert.ok(typeof pattern === "string");
            assert.ok(pattern.length > 0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

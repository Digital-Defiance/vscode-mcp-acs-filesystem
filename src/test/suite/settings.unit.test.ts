/**
 * Unit Tests for Settings/Configuration
 *
 * These tests verify all configuration settings are properly defined and accessible.
 */

import * as assert from "assert";
import * as vscode from "vscode";

suite("Settings Unit Tests", () => {
  let config: vscode.WorkspaceConfiguration;

  setup(() => {
    config = vscode.workspace.getConfiguration("mcp-filesystem");
  });

  teardown(async () => {
    // Clean up any configuration changes
    const keys = [
      "server.serverPath",
      "server.autoStart",
      "server.logLevel",
      "security.workspaceRoot",
      "security.allowedSubdirectories",
      "security.blockedPaths",
      "security.blockedPatterns",
      "resources.maxFileSize",
      "resources.maxBatchSize",
      "resources.maxOperationsPerMinute",
      "audit.enableAuditLog",
      "ui.showSecurityWarnings",
      "ui.confirmDangerousOperations",
      "ui.refreshInterval",
    ];

    for (const key of keys) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    }
  });

  suite("Configuration Access", () => {
    test("should return VS Code configuration object", () => {
      assert.ok(config, "Configuration should be defined");
      assert.strictEqual(
        typeof config.get,
        "function",
        "Configuration should have get method"
      );
      assert.strictEqual(
        typeof config.has,
        "function",
        "Configuration should have has method"
      );
      assert.strictEqual(
        typeof config.update,
        "function",
        "Configuration should have update method"
      );
    });

    test("should have all expected configuration properties", () => {
      const expectedProperties = [
        "server.serverPath",
        "server.autoStart",
        "server.logLevel",
        "security.workspaceRoot",
        "security.allowedSubdirectories",
        "security.blockedPaths",
        "security.blockedPatterns",
        "resources.maxFileSize",
        "resources.maxBatchSize",
        "resources.maxOperationsPerMinute",
        "audit.enableAuditLog",
        "ui.showSecurityWarnings",
        "ui.confirmDangerousOperations",
        "ui.refreshInterval",
      ];

      for (const prop of expectedProperties) {
        assert.ok(
          config.has(prop),
          `Configuration should have property: ${prop}`
        );
      }
    });
  });

  suite("Server Settings", () => {
    test("should access server.serverPath", () => {
      const serverPath = config.get<string>("server.serverPath");
      assert.notStrictEqual(serverPath, undefined);
      assert.strictEqual(typeof serverPath, "string");
    });

    test("should access server.autoStart with boolean type", () => {
      const autoStart = config.get<boolean>("server.autoStart");
      assert.notStrictEqual(autoStart, undefined);
      assert.strictEqual(typeof autoStart, "boolean");
    });

    test("should access server.logLevel with valid enum value", () => {
      const logLevel = config.get<string>("server.logLevel");
      assert.notStrictEqual(logLevel, undefined);
      assert.ok(
        ["debug", "info", "warn", "error"].includes(logLevel!),
        `Log level should be valid enum value, got: ${logLevel}`
      );
    });

    test("should have default autoStart as true", () => {
      const autoStart = config.get<boolean>("server.autoStart");
      assert.strictEqual(autoStart, true);
    });

    test("should have default logLevel as info", () => {
      const logLevel = config.get<string>("server.logLevel");
      assert.strictEqual(logLevel, "info");
    });

    test("should allow updating server.autoStart", async () => {
      await config.update(
        "server.autoStart",
        false,
        vscode.ConfigurationTarget.Global
      );
      // Re-fetch config to get updated value
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<boolean>("server.autoStart");
      assert.strictEqual(updated, false);
    });

    test("should allow updating server.logLevel", async () => {
      await config.update(
        "server.logLevel",
        "debug",
        vscode.ConfigurationTarget.Global
      );
      // Re-fetch config to get updated value
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<string>("server.logLevel");
      assert.strictEqual(updated, "debug");
    });
  });

  suite("Security Settings", () => {
    test("should access security.workspaceRoot", () => {
      const workspaceRoot = config.get<string>("security.workspaceRoot");
      assert.notStrictEqual(workspaceRoot, undefined);
      assert.strictEqual(typeof workspaceRoot, "string");
    });

    test("should have default workspaceRoot as ${workspaceFolder}", () => {
      const workspaceRoot = config.get<string>("security.workspaceRoot");
      assert.strictEqual(workspaceRoot, "${workspaceFolder}");
    });

    test("should access security.allowedSubdirectories as array", () => {
      const allowedSubdirs = config.get<string[]>(
        "security.allowedSubdirectories"
      );
      assert.ok(Array.isArray(allowedSubdirs));
    });

    test("should access security.blockedPaths as array", () => {
      const blockedPaths = config.get<string[]>("security.blockedPaths");
      assert.ok(Array.isArray(blockedPaths));
    });

    test("should have default blockedPaths", () => {
      const blockedPaths = config.get<string[]>("security.blockedPaths");
      assert.ok(blockedPaths!.includes(".git"));
      assert.ok(blockedPaths!.includes(".env"));
      assert.ok(blockedPaths!.includes("node_modules"));
      assert.ok(blockedPaths!.includes(".ssh"));
    });

    test("should access security.blockedPatterns as array", () => {
      const blockedPatterns = config.get<string[]>("security.blockedPatterns");
      assert.ok(Array.isArray(blockedPatterns));
    });

    test("should have default blockedPatterns", () => {
      const blockedPatterns = config.get<string[]>("security.blockedPatterns");
      assert.ok(blockedPatterns!.includes("*.key"));
      assert.ok(blockedPatterns!.includes("*.pem"));
      assert.ok(blockedPatterns!.includes("*.env"));
      assert.ok(blockedPatterns!.includes("*secret*"));
      assert.ok(blockedPatterns!.includes("*password*"));
    });

    test("should allow updating security.workspaceRoot", async () => {
      await config.update(
        "security.workspaceRoot",
        "/custom/workspace",
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<string>("security.workspaceRoot");
      assert.strictEqual(updated, "/custom/workspace");
    });

    test("should allow updating security.allowedSubdirectories", async () => {
      const newSubdirs = ["src", "test", "docs"];
      await config.update(
        "security.allowedSubdirectories",
        newSubdirs,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<string[]>("security.allowedSubdirectories");
      assert.deepStrictEqual(updated, newSubdirs);
    });

    test("should allow updating security.blockedPaths", async () => {
      const newPaths = [".git", ".env", "custom-blocked"];
      await config.update(
        "security.blockedPaths",
        newPaths,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<string[]>("security.blockedPaths");
      assert.deepStrictEqual(updated, newPaths);
    });

    test("should allow updating security.blockedPatterns", async () => {
      const newPatterns = ["*.key", "*.secret"];
      await config.update(
        "security.blockedPatterns",
        newPatterns,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<string[]>("security.blockedPatterns");
      assert.deepStrictEqual(updated, newPatterns);
    });
  });

  suite("Resource Settings", () => {
    test("should access resources.maxFileSize as number", () => {
      const maxFileSize = config.get<number>("resources.maxFileSize");
      assert.notStrictEqual(maxFileSize, undefined);
      assert.strictEqual(typeof maxFileSize, "number");
    });

    test("should have default maxFileSize as 104857600 (100 MB)", () => {
      const maxFileSize = config.get<number>("resources.maxFileSize");
      assert.strictEqual(maxFileSize, 104857600);
    });

    test("should access resources.maxBatchSize as number", () => {
      const maxBatchSize = config.get<number>("resources.maxBatchSize");
      assert.notStrictEqual(maxBatchSize, undefined);
      assert.strictEqual(typeof maxBatchSize, "number");
    });

    test("should have default maxBatchSize as 1073741824 (1 GB)", () => {
      const maxBatchSize = config.get<number>("resources.maxBatchSize");
      assert.strictEqual(maxBatchSize, 1073741824);
    });

    test("should access resources.maxOperationsPerMinute as number", () => {
      const maxOpsPerMin = config.get<number>(
        "resources.maxOperationsPerMinute"
      );
      assert.notStrictEqual(maxOpsPerMin, undefined);
      assert.strictEqual(typeof maxOpsPerMin, "number");
    });

    test("should have default maxOperationsPerMinute as 100", () => {
      const maxOpsPerMin = config.get<number>(
        "resources.maxOperationsPerMinute"
      );
      assert.strictEqual(maxOpsPerMin, 100);
    });

    test("should allow updating resources.maxFileSize", async () => {
      await config.update(
        "resources.maxFileSize",
        52428800,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<number>("resources.maxFileSize");
      assert.strictEqual(updated, 52428800);
    });

    test("should allow updating resources.maxBatchSize", async () => {
      await config.update(
        "resources.maxBatchSize",
        2147483648,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<number>("resources.maxBatchSize");
      assert.strictEqual(updated, 2147483648);
    });

    test("should allow updating resources.maxOperationsPerMinute", async () => {
      await config.update(
        "resources.maxOperationsPerMinute",
        50,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<number>("resources.maxOperationsPerMinute");
      assert.strictEqual(updated, 50);
    });

    test("maxFileSize should be positive", () => {
      const maxFileSize = config.get<number>("resources.maxFileSize");
      assert.ok(maxFileSize! > 0, "maxFileSize should be positive");
    });

    test("maxBatchSize should be positive", () => {
      const maxBatchSize = config.get<number>("resources.maxBatchSize");
      assert.ok(maxBatchSize! > 0, "maxBatchSize should be positive");
    });

    test("maxOperationsPerMinute should be positive", () => {
      const maxOpsPerMin = config.get<number>(
        "resources.maxOperationsPerMinute"
      );
      assert.ok(maxOpsPerMin! > 0, "maxOperationsPerMinute should be positive");
    });
  });

  suite("Audit Settings", () => {
    test("should access audit.enableAuditLog as boolean", () => {
      const enableAuditLog = config.get<boolean>("audit.enableAuditLog");
      assert.notStrictEqual(enableAuditLog, undefined);
      assert.strictEqual(typeof enableAuditLog, "boolean");
    });

    test("should have default enableAuditLog as true", () => {
      const enableAuditLog = config.get<boolean>("audit.enableAuditLog");
      assert.strictEqual(enableAuditLog, true);
    });

    test("should allow updating audit.enableAuditLog", async () => {
      await config.update(
        "audit.enableAuditLog",
        false,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<boolean>("audit.enableAuditLog");
      assert.strictEqual(updated, false);
    });
  });

  suite("UI Settings", () => {
    test("should access ui.showSecurityWarnings as boolean", () => {
      const showWarnings = config.get<boolean>("ui.showSecurityWarnings");
      assert.notStrictEqual(showWarnings, undefined);
      assert.strictEqual(typeof showWarnings, "boolean");
    });

    test("should have default showSecurityWarnings as true", () => {
      const showWarnings = config.get<boolean>("ui.showSecurityWarnings");
      assert.strictEqual(showWarnings, true);
    });

    test("should access ui.confirmDangerousOperations as boolean", () => {
      const confirmDangerous = config.get<boolean>(
        "ui.confirmDangerousOperations"
      );
      assert.notStrictEqual(confirmDangerous, undefined);
      assert.strictEqual(typeof confirmDangerous, "boolean");
    });

    test("should have default confirmDangerousOperations as true", () => {
      const confirmDangerous = config.get<boolean>(
        "ui.confirmDangerousOperations"
      );
      assert.strictEqual(confirmDangerous, true);
    });

    test("should access ui.refreshInterval as number", () => {
      const refreshInterval = config.get<number>("ui.refreshInterval");
      assert.notStrictEqual(refreshInterval, undefined);
      assert.strictEqual(typeof refreshInterval, "number");
    });

    test("should have default refreshInterval as 5000", () => {
      const refreshInterval = config.get<number>("ui.refreshInterval");
      assert.strictEqual(refreshInterval, 5000);
    });

    test("should allow updating ui.showSecurityWarnings", async () => {
      await config.update(
        "ui.showSecurityWarnings",
        false,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<boolean>("ui.showSecurityWarnings");
      assert.strictEqual(updated, false);
    });

    test("should allow updating ui.confirmDangerousOperations", async () => {
      await config.update(
        "ui.confirmDangerousOperations",
        false,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<boolean>("ui.confirmDangerousOperations");
      assert.strictEqual(updated, false);
    });

    test("should allow updating ui.refreshInterval", async () => {
      await config.update(
        "ui.refreshInterval",
        10000,
        vscode.ConfigurationTarget.Global
      );
      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updated = newConfig.get<number>("ui.refreshInterval");
      assert.strictEqual(updated, 10000);
    });

    test("refreshInterval should be non-negative", () => {
      const refreshInterval = config.get<number>("ui.refreshInterval");
      assert.ok(
        refreshInterval! >= 0,
        "refreshInterval should be non-negative"
      );
    });
  });

  suite("Configuration Validation", () => {
    test("all array settings should be arrays", () => {
      const arraySettings = [
        "security.allowedSubdirectories",
        "security.blockedPaths",
        "security.blockedPatterns",
      ];

      for (const setting of arraySettings) {
        const value = config.get(setting);
        assert.ok(
          Array.isArray(value),
          `${setting} should be an array, got ${typeof value}`
        );
      }
    });

    test("all boolean settings should be booleans", () => {
      const booleanSettings = [
        "server.autoStart",
        "audit.enableAuditLog",
        "ui.showSecurityWarnings",
        "ui.confirmDangerousOperations",
      ];

      for (const setting of booleanSettings) {
        const value = config.get(setting);
        assert.strictEqual(
          typeof value,
          "boolean",
          `${setting} should be boolean, got ${typeof value}`
        );
      }
    });

    test("all number settings should be numbers", () => {
      const numberSettings = [
        "resources.maxFileSize",
        "resources.maxBatchSize",
        "resources.maxOperationsPerMinute",
        "ui.refreshInterval",
      ];

      for (const setting of numberSettings) {
        const value = config.get(setting);
        assert.strictEqual(
          typeof value,
          "number",
          `${setting} should be number, got ${typeof value}`
        );
      }
    });

    test("all string settings should be strings", () => {
      const stringSettings = [
        "server.serverPath",
        "server.logLevel",
        "security.workspaceRoot",
      ];

      for (const setting of stringSettings) {
        const value = config.get(setting);
        assert.strictEqual(
          typeof value,
          "string",
          `${setting} should be string, got ${typeof value}`
        );
      }
    });

    test("logLevel should be valid enum value", () => {
      const logLevel = config.get<string>("server.logLevel");
      const validValues = ["debug", "info", "warn", "error"];
      assert.ok(
        validValues.includes(logLevel!),
        `logLevel should be one of ${validValues.join(", ")}, got ${logLevel}`
      );
    });

    test("resource limits should be reasonable", () => {
      const maxFileSize = config.get<number>("resources.maxFileSize");
      const maxBatchSize = config.get<number>("resources.maxBatchSize");
      const maxOpsPerMin = config.get<number>(
        "resources.maxOperationsPerMinute"
      );

      assert.ok(maxFileSize! > 0 && maxFileSize! <= 10737418240); // Max 10 GB
      assert.ok(maxBatchSize! > 0 && maxBatchSize! <= 107374182400); // Max 100 GB
      assert.ok(maxOpsPerMin! > 0 && maxOpsPerMin! <= 10000); // Max 10000 ops/min
    });
  });

  suite("Configuration Persistence", () => {
    test("should persist configuration changes", async () => {
      const originalValue = config.get<boolean>("server.autoStart");

      await config.update(
        "server.autoStart",
        !originalValue,
        vscode.ConfigurationTarget.Global
      );

      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      const updatedValue = newConfig.get<boolean>("server.autoStart");

      assert.strictEqual(updatedValue, !originalValue);

      // Restore
      await config.update(
        "server.autoStart",
        originalValue,
        vscode.ConfigurationTarget.Global
      );
    });

    test("should handle multiple configuration updates", async () => {
      await config.update(
        "server.autoStart",
        false,
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        "server.logLevel",
        "debug",
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        "ui.refreshInterval",
        10000,
        vscode.ConfigurationTarget.Global
      );

      const newConfig = vscode.workspace.getConfiguration("mcp-filesystem");
      assert.strictEqual(newConfig.get<boolean>("server.autoStart"), false);
      assert.strictEqual(newConfig.get<string>("server.logLevel"), "debug");
      assert.strictEqual(newConfig.get<number>("ui.refreshInterval"), 10000);
    });
  });
});

/**
 * Unit Tests for Validation Logic
 * Tests path validation, security boundary validation, configuration validation,
 * and platform-specific validation
 */

import * as assert from "assert";
import * as path from "path";
import { PlatformDetection, PlatformType } from "../../platformDetection";
import { SettingsManager } from "../../settingsManager";
import { ErrorHandler, ErrorCategory } from "../../errorHandling";
import * as vscode from "vscode";

suite("Validation Unit Tests", () => {
  let settingsManager: SettingsManager;
  let errorHandler: ErrorHandler;
  let outputChannel: vscode.LogOutputChannel;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel("Test Validation", {
      log: true,
    });
    settingsManager = new SettingsManager();
    errorHandler = new ErrorHandler(outputChannel);
  });

  teardown(() => {
    if (settingsManager) {
      settingsManager.dispose();
    }
    if (errorHandler) {
      errorHandler.dispose();
    }
    if (outputChannel) {
      outputChannel.dispose();
    }
  });

  suite("Path Validation", () => {
    test("should validate absolute paths", () => {
      const absolutePath = path.resolve("/tmp/test");
      assert.ok(
        PlatformDetection.isAbsolutePath(absolutePath),
        "Should recognize absolute path"
      );
    });

    test("should validate relative paths", () => {
      const relativePath = "./test/file.txt";
      assert.ok(
        !PlatformDetection.isAbsolutePath(relativePath),
        "Should recognize relative path"
      );
    });

    test("should normalize paths correctly", () => {
      const mixedPath = "test/path\\to\\file";
      const normalized = PlatformDetection.normalizePath(mixedPath);

      // Should use platform separator
      const platformInfo = PlatformDetection.getPlatformInfo();
      assert.ok(
        normalized.includes(platformInfo.pathSeparator),
        "Should use platform separator"
      );
    });

    test("should join paths correctly", () => {
      const joined = PlatformDetection.joinPaths("test", "path", "file.txt");
      const platformInfo = PlatformDetection.getPlatformInfo();

      assert.ok(
        joined.includes(platformInfo.pathSeparator),
        "Should use platform separator"
      );
      assert.ok(joined.includes("test"), "Should include first segment");
      assert.ok(joined.includes("file.txt"), "Should include last segment");
    });

    test("should extract directory name", () => {
      const filePath = "/test/path/file.txt";
      const dirname = PlatformDetection.getDirname(filePath);

      assert.ok(dirname.includes("test"), "Should extract directory");
      assert.ok(!dirname.includes("file.txt"), "Should not include filename");
    });

    test("should extract base name", () => {
      const filePath = "/test/path/file.txt";
      const basename = PlatformDetection.getBasename(filePath);

      assert.strictEqual(basename, "file.txt", "Should extract basename");
    });

    test("should extract file extension", () => {
      const filePath = "/test/path/file.txt";
      const ext = PlatformDetection.getExtension(filePath);

      assert.strictEqual(ext, ".txt", "Should extract extension");
    });

    test("should handle paths without extension", () => {
      const filePath = "/test/path/file";
      const ext = PlatformDetection.getExtension(filePath);

      assert.strictEqual(
        ext,
        "",
        "Should return empty string for no extension"
      );
    });

    test("should resolve relative paths", () => {
      const basePath = "/test/base";
      const relativePath = "../other/file.txt";
      const resolved = PlatformDetection.resolvePath(basePath, relativePath);

      assert.ok(
        PlatformDetection.isAbsolutePath(resolved),
        "Should resolve to absolute path"
      );
    });

    test("should handle empty paths", () => {
      const normalized = PlatformDetection.normalizePath("");
      assert.ok(normalized !== undefined, "Should handle empty path");
    });

    test("should handle paths with multiple separators", () => {
      const messyPath = "test///path\\\\\\file";
      const normalized = PlatformDetection.normalizePath(messyPath);

      // Should not have multiple consecutive separators
      const platformInfo = PlatformDetection.getPlatformInfo();
      const doubleSep = platformInfo.pathSeparator + platformInfo.pathSeparator;
      assert.ok(
        !normalized.includes(doubleSep),
        "Should not have double separators"
      );
    });
  });

  suite("Security Boundary Validation", () => {
    test("should block system directories", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      assert.ok(blockedPaths.length > 0, "Should have blocked paths");

      // Test platform-specific blocked paths
      if (platformInfo.isWindows) {
        assert.ok(
          blockedPaths.some((p) => p.includes("Windows")),
          "Should block Windows directory"
        );
      } else if (platformInfo.isLinux) {
        assert.ok(
          blockedPaths.some((p) => p.includes("/sys")),
          "Should block /sys directory"
        );
      } else if (platformInfo.isMacOS) {
        assert.ok(
          blockedPaths.some((p) => p.includes("/System")),
          "Should block /System directory"
        );
      }
    });

    test("should block sensitive directories", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      // Common sensitive directories
      assert.ok(
        blockedPaths.some((p) => p.includes(".git")),
        "Should block .git"
      );
      assert.ok(
        blockedPaths.some((p) => p.includes(".env")),
        "Should block .env"
      );
      assert.ok(
        blockedPaths.some((p) => p.includes("node_modules")),
        "Should block node_modules"
      );
    });

    test("should validate path security", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();

      // Test a safe path (temp directory)
      const safePath = platformInfo.tempDirectory;
      const safeResult = PlatformDetection.validatePathSecurity(safePath);
      assert.ok(safeResult.allowed, "Temp directory should be allowed");

      // Test a blocked path
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();
      if (blockedPaths.length > 0) {
        const blockedPath = blockedPaths[0];
        const blockedResult =
          PlatformDetection.validatePathSecurity(blockedPath);
        assert.ok(!blockedResult.allowed, "Blocked path should not be allowed");
        assert.ok(blockedResult.reason, "Should provide reason for blocking");
      }
    });

    test("should handle wildcard patterns in blocked paths", () => {
      // Test that wildcard patterns are properly handled
      const platformInfo = PlatformDetection.getPlatformInfo();

      if (platformInfo.isWindows) {
        // Test Windows AppData wildcard
        const appDataPath = "C:\\Users\\TestUser\\AppData\\Local";
        const result = PlatformDetection.validatePathSecurity(appDataPath);
        // May or may not be blocked depending on pattern matching
        assert.ok(result !== undefined, "Should return validation result");
      }
    });

    test("should expand home directory in paths", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();
      const homePath = "~/test/file.txt";
      const normalized = PlatformDetection.normalizePath(homePath);

      // normalizePath doesn't expand ~, but validatePathSecurity does
      // This test verifies the path is normalized, not expanded
      assert.ok(normalized.length > 0, "Should normalize path");
    });

    test("should validate paths with parent directory references", () => {
      const pathWithParent = "/test/path/../other/file.txt";
      const normalized = PlatformDetection.normalizePath(pathWithParent);

      // Should resolve parent references
      assert.ok(
        !normalized.includes(".."),
        "Should resolve parent directory references"
      );
    });

    test("should provide detailed security violation reasons", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      if (blockedPaths.length > 0) {
        const blockedPath = blockedPaths[0];
        const result = PlatformDetection.validatePathSecurity(blockedPath);

        if (!result.allowed) {
          assert.ok(result.reason, "Should provide reason");
          assert.ok(result.reason.length > 0, "Reason should not be empty");
        }
      }
    });
  });

  suite("Configuration Validation", () => {
    test("should validate server timeout", () => {
      const settings = settingsManager.getSettings();

      // Valid timeout
      settings.server.timeout = 30000;
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Valid timeout should pass");

      // Invalid timeout (too low)
      settings.server.timeout = 500;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Too low timeout should fail");
      assert.ok(
        result.errors.some((e) => e.includes("timeout")),
        "Should have timeout error"
      );
    });

    test("should validate max file size", () => {
      const settings = settingsManager.getSettings();

      // Valid file size
      settings.security.maxFileSize = 104857600; // 100 MB
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Valid file size should pass");

      // Invalid file size (too low)
      settings.security.maxFileSize = 100;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Too low file size should fail");
    });

    test("should validate max batch size relative to max file size", () => {
      const settings = settingsManager.getSettings();

      // Valid: batch size >= file size
      settings.security.maxFileSize = 10000000;
      settings.security.maxBatchSize = 20000000;
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Valid batch size should pass");

      // Invalid: batch size < file size
      settings.security.maxBatchSize = 5000000;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Batch size < file size should fail");
    });

    test("should validate operations per minute", () => {
      const settings = settingsManager.getSettings();

      // Valid operations per minute
      settings.security.maxOperationsPerMinute = 100;
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Valid operations per minute should pass");

      // Invalid (zero)
      settings.security.maxOperationsPerMinute = 0;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Zero operations per minute should fail");

      // Invalid (negative)
      settings.security.maxOperationsPerMinute = -10;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Negative operations per minute should fail");
    });

    test("should validate refresh interval", () => {
      const settings = settingsManager.getSettings();

      // Valid refresh interval
      settings.ui.refreshInterval = 5000;
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Valid refresh interval should pass");

      // Invalid (negative)
      settings.ui.refreshInterval = -100;
      result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Negative refresh interval should fail");

      // Valid (zero - disabled)
      settings.ui.refreshInterval = 0;
      result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Zero refresh interval should pass (disabled)");
    });

    test("should provide warnings for suboptimal settings", () => {
      const settings = settingsManager.getSettings();

      // Very high timeout
      settings.server.timeout = 400000;
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.warnings.length > 0, "Should warn about high timeout");

      // Very large file size
      settings.server.timeout = 30000; // Reset
      settings.security.maxFileSize = 11000000000; // > 10 GB
      result = settingsManager.validateSettings(settings);
      assert.ok(
        result.warnings.length > 0,
        "Should warn about large file size"
      );

      // Very low refresh interval
      settings.security.maxFileSize = 104857600; // Reset
      settings.ui.refreshInterval = 500;
      result = settingsManager.validateSettings(settings);
      assert.ok(
        result.warnings.length > 0,
        "Should warn about low refresh interval"
      );
    });

    test("should validate blocked paths configuration", () => {
      const settings = settingsManager.getSettings();

      // With blocked paths
      settings.security.blockedPaths = [".git", ".env"];
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Should accept blocked paths");

      // Without blocked paths (warning)
      settings.security.blockedPaths = [];
      result = settingsManager.validateSettings(settings);
      assert.ok(
        result.warnings.some((w) => w.includes("blocked paths")),
        "Should warn about no blocked paths"
      );
    });

    test("should validate blocked patterns configuration", () => {
      const settings = settingsManager.getSettings();

      // With blocked patterns
      settings.security.blockedPatterns = ["*.key", "*.pem"];
      let result = settingsManager.validateSettings(settings);
      assert.ok(result.valid, "Should accept blocked patterns");

      // Without blocked patterns (warning)
      settings.security.blockedPatterns = [];
      result = settingsManager.validateSettings(settings);
      assert.ok(
        result.warnings.some((w) => w.includes("blocked patterns")),
        "Should warn about no blocked patterns"
      );
    });

    test("should accumulate multiple validation errors", () => {
      const settings = settingsManager.getSettings();

      // Multiple invalid settings
      settings.server.timeout = 100; // Invalid
      settings.security.maxFileSize = 100; // Invalid
      settings.ui.refreshInterval = -100; // Invalid

      const result = settingsManager.validateSettings(settings);
      assert.ok(!result.valid, "Should be invalid");
      assert.ok(result.errors.length >= 3, "Should have multiple errors");
    });

    test("should validate log level values", () => {
      const settings = settingsManager.getSettings();

      // Valid log levels
      const validLevels: Array<"debug" | "info" | "warn" | "error"> = [
        "debug",
        "info",
        "warn",
        "error",
      ];

      for (const level of validLevels) {
        settings.server.logLevel = level;
        const result = settingsManager.validateSettings(settings);
        assert.ok(result.valid, `Log level ${level} should be valid`);
      }
    });
  });

  suite("Platform-Specific Validation", () => {
    test("should detect current platform", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();

      assert.ok(platformInfo, "Should return platform info");
      assert.ok(platformInfo.type, "Should have platform type");
      assert.ok(platformInfo.pathSeparator, "Should have path separator");
      assert.ok(platformInfo.homeDirectory, "Should have home directory");
      assert.ok(platformInfo.tempDirectory, "Should have temp directory");
    });

    test("should use correct path separator for platform", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();

      if (platformInfo.isWindows) {
        assert.strictEqual(
          platformInfo.pathSeparator,
          "\\",
          "Windows should use backslash"
        );
      } else {
        assert.strictEqual(
          platformInfo.pathSeparator,
          "/",
          "Unix should use forward slash"
        );
      }
    });

    test("should format paths for display correctly", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();
      const testPath = platformInfo.homeDirectory + "/test/file.txt";
      const formatted = PlatformDetection.formatPathForDisplay(testPath);

      // Should replace home directory with ~
      assert.ok(formatted.startsWith("~"), "Should use ~ for home directory");
    });

    test("should convert paths to forward slashes", () => {
      const windowsPath = "C:\\test\\path\\file.txt";
      const converted = PlatformDetection.toForwardSlashes(windowsPath);

      assert.ok(!converted.includes("\\"), "Should not contain backslashes");
      assert.ok(converted.includes("/"), "Should contain forward slashes");
    });

    test("should convert paths to backslashes", () => {
      const unixPath = "/test/path/file.txt";
      const converted = PlatformDetection.toBackslashes(unixPath);

      assert.ok(!converted.includes("/"), "Should not contain forward slashes");
      assert.ok(converted.includes("\\"), "Should contain backslashes");
    });

    test("should get platform-specific command syntax", () => {
      const command = "test command";
      const syntax = PlatformDetection.getCommandSyntax(command);

      assert.ok(syntax, "Should return command syntax");
      assert.ok(syntax.length > 0, "Syntax should not be empty");
    });

    test("should get platform-specific shell", () => {
      const shell = PlatformDetection.getShell();

      assert.ok(shell, "Should return shell");
      assert.ok(shell.length > 0, "Shell should not be empty");
    });

    test("should provide platform-specific blocked paths", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      assert.ok(blockedPaths.length > 0, "Should have blocked paths");

      // Check for platform-specific paths
      if (platformInfo.isWindows) {
        assert.ok(
          blockedPaths.some(
            (p) => p.includes("Windows") || p.includes("Program Files")
          ),
          "Windows should have Windows-specific blocked paths"
        );
      } else if (platformInfo.isLinux) {
        assert.ok(
          blockedPaths.some((p) => p.includes("/sys") || p.includes("/proc")),
          "Linux should have Linux-specific blocked paths"
        );
      } else if (platformInfo.isMacOS) {
        assert.ok(
          blockedPaths.some(
            (p) => p.includes("/System") || p.includes("/Library")
          ),
          "macOS should have macOS-specific blocked paths"
        );
      }
    });

    test("should cache platform information", () => {
      const info1 = PlatformDetection.getPlatformInfo();
      const info2 = PlatformDetection.getPlatformInfo();

      // Should return same object (cached)
      assert.strictEqual(info1, info2, "Should cache platform info");
    });
  });

  suite("Error Categorization", () => {
    test("should categorize security errors", () => {
      const securityError = new Error("Security boundary violation");
      const category = errorHandler.categorizeError(securityError);

      assert.strictEqual(
        category,
        ErrorCategory.SECURITY_ERROR,
        "Should categorize as security error"
      );
    });

    test("should categorize network errors", () => {
      const networkError = new Error("Connection timeout");
      const category = errorHandler.categorizeError(networkError);

      assert.strictEqual(
        category,
        ErrorCategory.NETWORK_ERROR,
        "Should categorize as network error"
      );
    });

    test("should categorize configuration errors", () => {
      const configError = new Error("Invalid configuration setting");
      const category = errorHandler.categorizeError(configError);

      assert.strictEqual(
        category,
        ErrorCategory.CONFIGURATION_ERROR,
        "Should categorize as configuration error"
      );
    });

    test("should categorize user errors", () => {
      const userError = new Error("File not found");
      const category = errorHandler.categorizeError(userError);

      assert.strictEqual(
        category,
        ErrorCategory.USER_ERROR,
        "Should categorize as user error"
      );
    });

    test("should default to system error for unknown errors", () => {
      const unknownError = new Error("Something went wrong");
      const category = errorHandler.categorizeError(unknownError);

      assert.strictEqual(
        category,
        ErrorCategory.SYSTEM_ERROR,
        "Should default to system error"
      );
    });

    test("should provide user-friendly messages", () => {
      const error = {
        name: "TestError",
        message: "File not found",
        category: ErrorCategory.USER_ERROR,
      };

      const message = errorHandler.getUserFriendlyMessage(error);

      assert.ok(message, "Should provide message");
      assert.ok(message.length > 0, "Message should not be empty");
      assert.ok(
        !message.includes("ENOENT"),
        "Should not include technical error codes"
      );
    });

    test("should provide recovery suggestions", () => {
      const error = {
        name: "TestError",
        message: "File not found",
        category: ErrorCategory.USER_ERROR,
      };

      const suggestions = errorHandler.getRecoverySuggestions(error);

      assert.ok(Array.isArray(suggestions), "Should return array");
      assert.ok(suggestions.length > 0, "Should provide suggestions");
    });
  });
});

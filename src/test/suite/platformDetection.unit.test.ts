/**
 * Unit Tests for Platform Detection
 */

import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import {
  PlatformDetection,
  PlatformType,
  PlatformInfo,
} from "../../platformDetection";

suite("Platform Detection Unit Tests", () => {
  suite("Platform Detection", () => {
    test("should detect current platform", () => {
      const info = PlatformDetection.getPlatformInfo();

      assert.ok(info, "Platform info should be returned");
      assert.ok(
        Object.values(PlatformType).includes(info.type),
        "Platform type should be valid"
      );
    });

    test("should return consistent platform info", () => {
      const info1 = PlatformDetection.getPlatformInfo();
      const info2 = PlatformDetection.getPlatformInfo();

      assert.strictEqual(info1.type, info2.type, "Platform type should match");
      assert.strictEqual(
        info1.pathSeparator,
        info2.pathSeparator,
        "Path separator should match"
      );
      assert.strictEqual(
        info1.homeDirectory,
        info2.homeDirectory,
        "Home directory should match"
      );
    });

    test("should have valid path separator", () => {
      const info = PlatformDetection.getPlatformInfo();

      assert.ok(
        info.pathSeparator === "/" || info.pathSeparator === "\\",
        "Path separator should be / or \\"
      );
      assert.strictEqual(
        info.pathSeparator,
        path.sep,
        "Path separator should match Node.js path.sep"
      );
    });

    test("should have valid home directory", () => {
      const info = PlatformDetection.getPlatformInfo();

      assert.ok(
        typeof info.homeDirectory === "string",
        "Home directory should be a string"
      );
      assert.ok(
        info.homeDirectory.length > 0,
        "Home directory should not be empty"
      );
      assert.strictEqual(
        info.homeDirectory,
        os.homedir(),
        "Home directory should match os.homedir()"
      );
    });

    test("should have valid temp directory", () => {
      const info = PlatformDetection.getPlatformInfo();

      assert.ok(
        typeof info.tempDirectory === "string",
        "Temp directory should be a string"
      );
      assert.ok(
        info.tempDirectory.length > 0,
        "Temp directory should not be empty"
      );
      assert.strictEqual(
        info.tempDirectory,
        os.tmpdir(),
        "Temp directory should match os.tmpdir()"
      );
    });

    test("should have consistent boolean flags", () => {
      const info = PlatformDetection.getPlatformInfo();

      const trueCount = [info.isWindows, info.isMacOS, info.isLinux].filter(
        (b) => b
      ).length;

      assert.ok(trueCount <= 1, "At most one platform boolean should be true");
    });

    test("should match Node.js platform detection", () => {
      const info = PlatformDetection.getPlatformInfo();
      const nodePlatform = os.platform();

      if (nodePlatform === "win32") {
        assert.strictEqual(
          info.type,
          PlatformType.WINDOWS,
          "Should detect Windows"
        );
        assert.ok(info.isWindows, "isWindows should be true");
      } else if (nodePlatform === "darwin") {
        assert.strictEqual(
          info.type,
          PlatformType.MACOS,
          "Should detect macOS"
        );
        assert.ok(info.isMacOS, "isMacOS should be true");
      } else if (nodePlatform === "linux") {
        assert.strictEqual(
          info.type,
          PlatformType.LINUX,
          "Should detect Linux"
        );
        assert.ok(info.isLinux, "isLinux should be true");
      }
    });
  });

  suite("Path Normalization", () => {
    test("should normalize forward slashes", () => {
      const normalized = PlatformDetection.normalizePath(
        "folder/subfolder/file.txt"
      );

      assert.ok(
        typeof normalized === "string",
        "Normalized path should be a string"
      );
      assert.ok(
        normalized.includes(path.sep),
        "Normalized path should use platform separator"
      );
    });

    test("should normalize backslashes", () => {
      const normalized = PlatformDetection.normalizePath(
        "folder\\subfolder\\file.txt"
      );

      assert.ok(
        typeof normalized === "string",
        "Normalized path should be a string"
      );
    });

    test("should normalize mixed separators", () => {
      const normalized = PlatformDetection.normalizePath(
        "folder/subfolder\\file.txt"
      );

      assert.ok(
        typeof normalized === "string",
        "Normalized path should be a string"
      );
    });

    test("should handle empty path", () => {
      const normalized = PlatformDetection.normalizePath("");

      assert.ok(
        typeof normalized === "string",
        "Empty path should return a string"
      );
    });

    test("should handle single segment", () => {
      const normalized = PlatformDetection.normalizePath("file.txt");

      assert.ok(
        typeof normalized === "string",
        "Single segment should return a string"
      );
    });

    test("should handle root paths", () => {
      const rootPaths = ["/", "\\"];

      for (const rootPath of rootPaths) {
        const normalized = PlatformDetection.normalizePath(rootPath);
        assert.ok(
          typeof normalized === "string",
          `Root path "${rootPath}" should return a string`
        );
      }
    });

    test("should be idempotent", () => {
      const testPath = "folder/subfolder/file.txt";

      const normalized1 = PlatformDetection.normalizePath(testPath);
      const normalized2 = PlatformDetection.normalizePath(normalized1);
      const normalized3 = PlatformDetection.normalizePath(normalized2);

      assert.strictEqual(
        normalized1,
        normalized2,
        "Second normalization should produce same result"
      );
      assert.strictEqual(
        normalized2,
        normalized3,
        "Third normalization should produce same result"
      );
    });
  });

  suite("Path Joining", () => {
    test("should join path segments", () => {
      const joined = PlatformDetection.joinPaths(
        "folder",
        "subfolder",
        "file.txt"
      );

      assert.ok(typeof joined === "string", "Joined path should be a string");
      assert.ok(
        joined.includes("folder"),
        "Joined path should contain first segment"
      );
      assert.ok(
        joined.includes("file.txt"),
        "Joined path should contain last segment"
      );
    });

    test("should use platform separator", () => {
      const joined = PlatformDetection.joinPaths("folder", "subfolder");
      const info = PlatformDetection.getPlatformInfo();

      assert.ok(
        joined.includes(info.pathSeparator),
        "Joined path should use platform separator"
      );
    });

    test("should handle single segment", () => {
      const joined = PlatformDetection.joinPaths("folder");

      assert.strictEqual(
        joined,
        "folder",
        "Single segment should be unchanged"
      );
    });

    test("should handle empty segments", () => {
      const joined = PlatformDetection.joinPaths("folder", "", "file.txt");

      assert.ok(typeof joined === "string", "Should handle empty segments");
    });
  });

  suite("Path Conversion", () => {
    test("should convert to forward slashes", () => {
      const converted = PlatformDetection.toForwardSlashes(
        "folder\\subfolder\\file.txt"
      );

      assert.ok(
        !converted.includes("\\"),
        "Converted path should not contain backslashes"
      );
      assert.ok(
        converted.includes("/"),
        "Converted path should contain forward slashes"
      );
    });

    test("should convert to backslashes", () => {
      const converted = PlatformDetection.toBackslashes(
        "folder/subfolder/file.txt"
      );

      assert.ok(
        !converted.includes("/"),
        "Converted path should not contain forward slashes"
      );
      assert.ok(
        converted.includes("\\"),
        "Converted path should contain backslashes"
      );
    });

    test("should handle already converted paths", () => {
      const forwardPath = "folder/subfolder/file.txt";
      const converted = PlatformDetection.toForwardSlashes(forwardPath);

      assert.strictEqual(
        converted,
        forwardPath,
        "Already forward slash path should be unchanged"
      );
    });
  });

  suite("Command Syntax", () => {
    test("should format command syntax", () => {
      const formatted = PlatformDetection.getCommandSyntax("test command");

      assert.ok(
        typeof formatted === "string",
        "Formatted command should be a string"
      );
    });

    test("should handle commands without spaces", () => {
      const formatted = PlatformDetection.getCommandSyntax("command");

      assert.ok(
        typeof formatted === "string",
        "Command without spaces should be formatted"
      );
    });

    test("should handle commands with spaces", () => {
      const formatted = PlatformDetection.getCommandSyntax(
        "command with spaces"
      );
      const info = PlatformDetection.getPlatformInfo();

      if (info.isWindows) {
        // Windows should quote
        assert.ok(
          formatted.includes('"') || formatted === "command with spaces",
          "Windows command with spaces should be quoted"
        );
      } else {
        // Unix should escape
        assert.ok(
          formatted.includes("\\ ") || !formatted.includes(" "),
          "Unix command with spaces should have escaped spaces"
        );
      }
    });

    test("should get shell", () => {
      const shell = PlatformDetection.getShell();

      assert.ok(typeof shell === "string", "Shell should be a string");
      assert.ok(shell.length > 0, "Shell should not be empty");
    });

    test("should return consistent shell", () => {
      const shell1 = PlatformDetection.getShell();
      const shell2 = PlatformDetection.getShell();

      assert.strictEqual(shell1, shell2, "Shell should be consistent");
    });
  });

  suite("Security Boundaries", () => {
    test("should return blocked paths", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      assert.ok(
        Array.isArray(blockedPaths),
        "Blocked paths should be an array"
      );
      assert.ok(
        blockedPaths.length > 0,
        "Should have at least some blocked paths"
      );
    });

    test("should include common blocked paths", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      assert.ok(blockedPaths.includes(".git"), "Should block .git directory");
      assert.ok(blockedPaths.includes(".env"), "Should block .env files");
      assert.ok(
        blockedPaths.includes("node_modules"),
        "Should block node_modules"
      );
    });

    test("should include platform-specific blocked paths", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();
      const info = PlatformDetection.getPlatformInfo();

      if (info.isWindows) {
        const hasWindowsPaths = blockedPaths.some(
          (p) => p.includes("C:\\") || p.includes("Windows")
        );
        assert.ok(
          hasWindowsPaths,
          "Windows should have Windows-specific blocked paths"
        );
      } else if (info.isMacOS) {
        const hasMacPaths = blockedPaths.some(
          (p) => p.includes("/System") || p.includes("/Library")
        );
        assert.ok(
          hasMacPaths,
          "macOS should have macOS-specific blocked paths"
        );
      } else if (info.isLinux) {
        const hasLinuxPaths = blockedPaths.some(
          (p) => p.includes("/sys") || p.includes("/proc")
        );
        assert.ok(
          hasLinuxPaths,
          "Linux should have Linux-specific blocked paths"
        );
      }
    });

    test("should validate path security", () => {
      const validation =
        PlatformDetection.validatePathSecurity("/tmp/test.txt");

      assert.ok(
        typeof validation === "object",
        "Validation should return an object"
      );
      assert.ok(
        typeof validation.allowed === "boolean",
        "Validation should have allowed property"
      );
    });

    test("should block .git directory", () => {
      const validation = PlatformDetection.validatePathSecurity(".git");

      assert.strictEqual(validation.allowed, false, ".git should be blocked");
      assert.ok(validation.reason, "Should provide a reason");
    });

    test("should block .env files", () => {
      const validation = PlatformDetection.validatePathSecurity(".env");

      assert.strictEqual(validation.allowed, false, ".env should be blocked");
      assert.ok(validation.reason, "Should provide a reason");
    });

    test("should block node_modules", () => {
      const validation = PlatformDetection.validatePathSecurity("node_modules");

      assert.strictEqual(
        validation.allowed,
        false,
        "node_modules should be blocked"
      );
      assert.ok(validation.reason, "Should provide a reason");
    });

    test("should be consistent", () => {
      const testPath = "/tmp/test.txt";

      const validation1 = PlatformDetection.validatePathSecurity(testPath);
      const validation2 = PlatformDetection.validatePathSecurity(testPath);

      assert.strictEqual(
        validation1.allowed,
        validation2.allowed,
        "Validation should be consistent"
      );
      assert.strictEqual(
        validation1.reason,
        validation2.reason,
        "Reason should be consistent"
      );
    });
  });

  suite("Path Formatting", () => {
    test("should format path for display", () => {
      const formatted = PlatformDetection.formatPathForDisplay("/tmp/test.txt");

      assert.ok(
        typeof formatted === "string",
        "Formatted path should be a string"
      );
    });

    test("should replace home directory with tilde", () => {
      const info = PlatformDetection.getPlatformInfo();
      const testPath = PlatformDetection.joinPaths(
        info.homeDirectory,
        "Documents",
        "test.txt"
      );

      const formatted = PlatformDetection.formatPathForDisplay(testPath);

      assert.ok(
        formatted.startsWith("~"),
        "Home directory should be replaced with ~"
      );
      assert.ok(
        !formatted.includes(info.homeDirectory),
        "Formatted path should not contain full home directory"
      );
    });

    test("should handle non-home paths", () => {
      const formatted = PlatformDetection.formatPathForDisplay("/tmp/test.txt");

      assert.ok(
        typeof formatted === "string",
        "Non-home path should be formatted"
      );
    });

    test("should be idempotent", () => {
      const testPath = "/tmp/test.txt";

      const formatted1 = PlatformDetection.formatPathForDisplay(testPath);
      const formatted2 = PlatformDetection.formatPathForDisplay(formatted1);
      const formatted3 = PlatformDetection.formatPathForDisplay(formatted2);

      assert.strictEqual(
        formatted1,
        formatted2,
        "Second formatting should produce same result"
      );
      assert.strictEqual(
        formatted2,
        formatted3,
        "Third formatting should produce same result"
      );
    });

    test("should handle special paths", () => {
      const specialPaths = [".", "..", "/"];

      for (const specialPath of specialPaths) {
        const formatted = PlatformDetection.formatPathForDisplay(specialPath);

        assert.ok(
          typeof formatted === "string",
          `Special path "${specialPath}" should format to a string`
        );
        assert.ok(
          formatted.length > 0,
          `Special path "${specialPath}" should not format to empty string`
        );
      }
    });
  });

  suite("Path Utilities", () => {
    test("should check if path is absolute", () => {
      const isAbsolute = PlatformDetection.isAbsolutePath("/tmp/test.txt");

      assert.ok(
        typeof isAbsolute === "boolean",
        "isAbsolutePath should return a boolean"
      );
    });

    test("should get dirname", () => {
      const dirname = PlatformDetection.getDirname("/tmp/test.txt");

      assert.ok(typeof dirname === "string", "Dirname should be a string");
      assert.ok(
        dirname.includes("tmp") || dirname === "/tmp",
        "Dirname should contain parent directory"
      );
    });

    test("should get basename", () => {
      const basename = PlatformDetection.getBasename("/tmp/test.txt");

      assert.strictEqual(
        basename,
        "test.txt",
        "Basename should be the filename"
      );
    });

    test("should get extension", () => {
      const extension = PlatformDetection.getExtension("/tmp/test.txt");

      assert.strictEqual(extension, ".txt", "Extension should be .txt");
    });

    test("should handle path without extension", () => {
      const extension = PlatformDetection.getExtension("/tmp/test");

      assert.strictEqual(
        extension,
        "",
        "Path without extension should return empty string"
      );
    });

    test("should resolve path", () => {
      const resolved = PlatformDetection.resolvePath("/tmp", "test.txt");

      assert.ok(
        typeof resolved === "string",
        "Resolved path should be a string"
      );
      assert.ok(
        resolved.includes("tmp"),
        "Resolved path should contain base path"
      );
      assert.ok(
        resolved.includes("test.txt"),
        "Resolved path should contain relative path"
      );
    });
  });
});

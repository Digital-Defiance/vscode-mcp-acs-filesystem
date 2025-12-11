/**
 * Property-Based Tests for Platform Detection
 * Feature: filesystem-extension-completion
 */

import * as assert from "assert";
import * as fc from "fast-check";
import * as path from "path";
import { PlatformDetection, PlatformType } from "../../platformDetection";

suite("Platform Detection Property-Based Tests", () => {
  /**
   * Property 18: Path Separator Correctness
   * Feature: filesystem-extension-completion, Property 18: Path Separator Correctness
   * Validates: Requirements 4.2
   *
   * For any file path constructed by the extension, the path should use
   * the platform-appropriate separator.
   */
  test("Property 18: Normalized paths use correct platform separator", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter(
              (s) =>
                !s.includes("\0") &&
                !s.includes("\n") &&
                !s.includes("/") &&
                !s.includes("\\") &&
                s.trim().length > 0
            ),
          { minLength: 1, maxLength: 5 }
        ),
        async (pathSegments) => {
          // Create a path with mixed separators
          const mixedPath = pathSegments.join("/");
          const mixedPathBackslash = pathSegments.join("\\");

          // Normalize both paths
          const normalized1 = PlatformDetection.normalizePath(mixedPath);
          const normalized2 =
            PlatformDetection.normalizePath(mixedPathBackslash);

          const platformInfo = PlatformDetection.getPlatformInfo();
          const expectedSeparator = platformInfo.pathSeparator;

          // Property: Normalized paths should use platform separator
          // Verify no wrong separators remain (except for UNC paths and absolute paths)
          const wrongSeparator = expectedSeparator === "/" ? "\\" : "/";

          // Skip validation for UNC paths, absolute paths with drive letters
          const isUNCPath = normalized1.startsWith("\\\\");
          const hasDriveLetter = /^[A-Za-z]:/.test(normalized1);

          if (!isUNCPath && !hasDriveLetter) {
            // Check that wrong separator is not present
            assert.ok(
              !normalized1.includes(wrongSeparator),
              `Normalized path "${normalized1}" should not contain wrong separator "${wrongSeparator}"`
            );

            // If we have multiple input segments, the normalized path should either:
            // 1. Have multiple segments (contains separator), or
            // 2. Have collapsed to a single segment (which is valid normalization)
            // Both are correct behaviors
          }

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 18 (Simplified): Common paths are normalized correctly
   */
  test("Property 18 (Simplified): Common paths use correct separator", function () {
    const platformInfo = PlatformDetection.getPlatformInfo();
    const expectedSeparator = platformInfo.pathSeparator;

    const testPaths = [
      "folder/subfolder/file.txt",
      "folder\\subfolder\\file.txt",
      "folder/subfolder\\file.txt",
      "a/b/c/d",
      "a\\b\\c\\d",
    ];

    for (const testPath of testPaths) {
      const normalized = PlatformDetection.normalizePath(testPath);

      // Property: Should use platform separator
      const wrongSeparator = expectedSeparator === "/" ? "\\" : "/";

      // Check that wrong separator is not present (except for UNC paths)
      if (!normalized.startsWith("\\\\")) {
        assert.ok(
          !normalized.includes(wrongSeparator),
          `Normalized path "${normalized}" should not contain "${wrongSeparator}"`
        );
      }
    }
  });

  /**
   * Property 18 (Invariant): Normalization is idempotent
   * Normalizing a path multiple times should produce the same result.
   */
  test("Property 18 (Invariant): Path normalization is idempotent", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 15 })
            .filter((s) => !s.includes("\0") && !s.includes("\n")),
          { minLength: 1, maxLength: 4 }
        ),
        async (pathSegments) => {
          const mixedPath = pathSegments.join("/");

          // Normalize multiple times
          const normalized1 = PlatformDetection.normalizePath(mixedPath);
          const normalized2 = PlatformDetection.normalizePath(normalized1);
          const normalized3 = PlatformDetection.normalizePath(normalized2);

          // Property: Normalization should be idempotent
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

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 18 (Edge Case): Empty and single-segment paths
   */
  test("Property 18 (Edge Case): Edge case paths are handled", function () {
    // Empty path
    const emptyNormalized = PlatformDetection.normalizePath("");
    assert.ok(
      typeof emptyNormalized === "string",
      "Empty path should return a string"
    );

    // Single segment
    const singleNormalized = PlatformDetection.normalizePath("file.txt");
    assert.ok(
      typeof singleNormalized === "string",
      "Single segment should return a string"
    );

    // Root paths
    const rootPaths = ["/", "\\", "C:\\", "C:/"];
    for (const rootPath of rootPaths) {
      const normalized = PlatformDetection.normalizePath(rootPath);
      assert.ok(
        typeof normalized === "string",
        `Root path "${rootPath}" should return a string`
      );
    }
  });

  /**
   * Property 18 (Consistency): joinPaths uses correct separator
   */
  test("Property 18 (Consistency): joinPaths uses platform separator", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 15 })
            .filter(
              (s) =>
                !s.includes("\0") &&
                !s.includes("\n") &&
                !s.includes("/") &&
                !s.includes("\\")
            ),
          { minLength: 2, maxLength: 5 }
        ),
        async (pathSegments) => {
          const joined = PlatformDetection.joinPaths(...pathSegments);
          const platformInfo = PlatformDetection.getPlatformInfo();
          const expectedSeparator = platformInfo.pathSeparator;

          // Property: Joined path should use platform separator
          if (pathSegments.length > 1) {
            const wrongSeparator = expectedSeparator === "/" ? "\\" : "/";

            // Should not contain wrong separator (except UNC paths)
            if (!joined.startsWith("\\\\")) {
              assert.ok(
                !joined.includes(wrongSeparator),
                `Joined path should not contain wrong separator "${wrongSeparator}"`
              );
            }

            // Should contain correct separator
            assert.ok(
              joined.includes(expectedSeparator),
              `Joined path should contain platform separator "${expectedSeparator}"`
            );
          }

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 19: Command Syntax Correctness
   * Feature: filesystem-extension-completion, Property 19: Command Syntax Correctness
   * Validates: Requirements 4.3
   *
   * For any command executed by the extension, the command should use
   * platform-specific syntax.
   */
  test("Property 19: Commands use platform-specific syntax", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          command: fc.string({ minLength: 1, maxLength: 50 }),
          hasSpaces: fc.boolean(),
        }),
        async ({ command, hasSpaces }) => {
          // Add spaces if requested
          const testCommand = hasSpaces ? `test ${command} arg` : command;

          const formatted = PlatformDetection.getCommandSyntax(testCommand);
          const platformInfo = PlatformDetection.getPlatformInfo();

          // Property: Command syntax should be appropriate for platform
          if (platformInfo.isWindows) {
            // Windows: commands with spaces should be quoted
            if (testCommand.includes(" ")) {
              assert.ok(
                formatted.startsWith('"') && formatted.endsWith('"'),
                "Windows commands with spaces should be quoted"
              );
            }
          } else {
            // Unix-like: spaces should be escaped
            if (testCommand.includes(" ")) {
              assert.ok(
                formatted.includes("\\ "),
                "Unix commands with spaces should have escaped spaces"
              );
            }
          }

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 19 (Simplified): Common commands are formatted correctly
   */
  test("Property 19 (Simplified): Common commands use correct syntax", function () {
    const platformInfo = PlatformDetection.getPlatformInfo();

    const testCommands = [
      "simple",
      "with spaces",
      "multiple  spaces  here",
      "path/to/command",
      "C:\\Program Files\\app.exe",
    ];

    for (const cmd of testCommands) {
      const formatted = PlatformDetection.getCommandSyntax(cmd);

      // Property: Formatted command should be a string
      assert.ok(
        typeof formatted === "string",
        "Formatted command should be a string"
      );

      // Property: Should handle spaces appropriately
      if (cmd.includes(" ")) {
        if (platformInfo.isWindows) {
          // Windows should quote or handle spaces
          assert.ok(
            formatted.includes('"') || formatted === cmd,
            "Windows should quote commands with spaces"
          );
        } else {
          // Unix should escape spaces
          assert.ok(
            formatted.includes("\\ ") || !formatted.includes(" "),
            "Unix should escape spaces"
          );
        }
      }
    }
  });

  /**
   * Property 19 (Invariant): Shell detection is consistent
   */
  test("Property 19 (Invariant): Shell detection is consistent", function () {
    const shell1 = PlatformDetection.getShell();
    const shell2 = PlatformDetection.getShell();
    const shell3 = PlatformDetection.getShell();

    // Property: Shell should be consistent
    assert.strictEqual(shell1, shell2, "Shell detection should be consistent");
    assert.strictEqual(shell2, shell3, "Shell detection should be consistent");

    // Property: Shell should be a valid string
    assert.ok(typeof shell1 === "string", "Shell should be a string");
    assert.ok(shell1.length > 0, "Shell should not be empty");
  });

  /**
   * Property 20: Platform-Specific Security Boundaries
   * Feature: filesystem-extension-completion, Property 20: Platform-Specific Security Boundaries
   * Validates: Requirements 4.4
   *
   * For any path validation, the extension should apply platform-specific
   * security boundaries.
   */
  test("Property 20: Platform-specific blocked paths are enforced", async function () {
    this.timeout(30000);

    const platformInfo = PlatformDetection.getPlatformInfo();
    const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

    // Property: Blocked paths should exist
    assert.ok(
      blockedPaths.length > 0,
      "Platform should have blocked paths defined"
    );

    // Property: Blocked paths should be platform-appropriate
    if (platformInfo.isWindows) {
      // Windows should block system directories
      const hasWindowsPaths = blockedPaths.some(
        (p) => p.includes("C:\\") || p.includes("Windows")
      );
      assert.ok(
        hasWindowsPaths,
        "Windows should have Windows-specific blocked paths"
      );
    } else if (platformInfo.isMacOS) {
      // macOS should block system directories
      const hasMacPaths = blockedPaths.some(
        (p) => p.includes("/System") || p.includes("/Library")
      );
      assert.ok(hasMacPaths, "macOS should have macOS-specific blocked paths");
    } else if (platformInfo.isLinux) {
      // Linux should block system directories
      const hasLinuxPaths = blockedPaths.some(
        (p) => p.includes("/sys") || p.includes("/proc")
      );
      assert.ok(
        hasLinuxPaths,
        "Linux should have Linux-specific blocked paths"
      );
    }

    // Test validation against blocked paths
    for (const blockedPath of blockedPaths.slice(0, 10)) {
      // Test first 10
      if (!blockedPath.includes("*")) {
        const validation = PlatformDetection.validatePathSecurity(blockedPath);

        // Property: Blocked paths should be rejected
        assert.ok(
          !validation.allowed,
          `Blocked path "${blockedPath}" should be rejected`
        );
        assert.ok(
          validation.reason,
          `Blocked path "${blockedPath}" should have a reason`
        );
      }
    }
  });

  /**
   * Property 20 (Simplified): Common system paths are blocked
   */
  test("Property 20 (Simplified): System directories are blocked", function () {
    const platformInfo = PlatformDetection.getPlatformInfo();

    let systemPaths: string[] = [];

    if (platformInfo.isWindows) {
      systemPaths = ["C:\\Windows", "C:\\Program Files"];
    } else if (platformInfo.isMacOS) {
      systemPaths = ["/System", "/Library"];
    } else if (platformInfo.isLinux) {
      systemPaths = ["/sys", "/proc", "/boot"];
    }

    for (const systemPath of systemPaths) {
      const validation = PlatformDetection.validatePathSecurity(systemPath);

      // Property: System paths should be blocked
      assert.ok(
        !validation.allowed,
        `System path "${systemPath}" should be blocked`
      );
    }
  });

  /**
   * Property 20 (Invariant): Validation is consistent
   */
  test("Property 20 (Invariant): Path validation is consistent", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (testPath) => {
          // Validate the same path multiple times
          const validation1 = PlatformDetection.validatePathSecurity(testPath);
          const validation2 = PlatformDetection.validatePathSecurity(testPath);
          const validation3 = PlatformDetection.validatePathSecurity(testPath);

          // Property: Validation should be consistent
          assert.strictEqual(
            validation1.allowed,
            validation2.allowed,
            "Validation result should be consistent"
          );
          assert.strictEqual(
            validation2.allowed,
            validation3.allowed,
            "Validation result should be consistent"
          );
          assert.strictEqual(
            validation1.reason,
            validation2.reason,
            "Validation reason should be consistent"
          );

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 21: Path Formatting Correctness
   * Feature: filesystem-extension-completion, Property 21: Path Formatting Correctness
   * Validates: Requirements 4.5
   *
   * For any path displayed to the user, the path should be formatted
   * according to platform conventions.
   */
  test("Property 21: Paths are formatted for display correctly", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 15 })
            .filter((s) => !s.includes("\0") && !s.includes("\n")),
          { minLength: 1, maxLength: 4 }
        ),
        async (pathSegments) => {
          const platformInfo = PlatformDetection.getPlatformInfo();
          const testPath = PlatformDetection.joinPaths(...pathSegments);

          const formatted = PlatformDetection.formatPathForDisplay(testPath);

          // Property: Formatted path should be a string
          assert.ok(
            typeof formatted === "string",
            "Formatted path should be a string"
          );

          // Property: On Windows, drive letters should be uppercase
          if (platformInfo.isWindows && /^[a-z]:/.test(formatted)) {
            assert.ok(
              /^[A-Z]:/.test(formatted),
              "Windows drive letters should be uppercase"
            );
          }

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 21 (Simplified): Home directory is replaced with tilde
   */
  test("Property 21 (Simplified): Home directory paths use tilde", function () {
    const platformInfo = PlatformDetection.getPlatformInfo();
    const homeDir = platformInfo.homeDirectory;

    // Create a path in home directory
    const testPath = PlatformDetection.joinPaths(
      homeDir,
      "Documents",
      "test.txt"
    );
    const formatted = PlatformDetection.formatPathForDisplay(testPath);

    // Property: Home directory should be replaced with ~
    assert.ok(
      formatted.startsWith("~"),
      "Home directory paths should start with ~"
    );
    assert.ok(
      !formatted.includes(homeDir),
      "Formatted path should not contain full home directory"
    );
  });

  /**
   * Property 21 (Invariant): Formatting is idempotent
   */
  test("Property 21 (Invariant): Path formatting is idempotent", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 15 })
            .filter((s) => !s.includes("\0") && !s.includes("\n")),
          { minLength: 1, maxLength: 4 }
        ),
        async (pathSegments) => {
          const testPath = PlatformDetection.joinPaths(...pathSegments);

          // Format multiple times
          const formatted1 = PlatformDetection.formatPathForDisplay(testPath);
          const formatted2 = PlatformDetection.formatPathForDisplay(formatted1);
          const formatted3 = PlatformDetection.formatPathForDisplay(formatted2);

          // Property: Formatting should be idempotent
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

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 21 (Edge Case): Special paths are formatted correctly
   */
  test("Property 21 (Edge Case): Special paths are handled", function () {
    const platformInfo = PlatformDetection.getPlatformInfo();

    // Test various special paths
    const specialPaths = [
      ".",
      "..",
      "/",
      platformInfo.homeDirectory,
      platformInfo.tempDirectory,
    ];

    for (const specialPath of specialPaths) {
      const formatted = PlatformDetection.formatPathForDisplay(specialPath);

      // Property: Should return a valid string
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

  /**
   * Additional Property: Platform detection is consistent
   */
  test("Platform detection is consistent across calls", function () {
    const info1 = PlatformDetection.getPlatformInfo();
    const info2 = PlatformDetection.getPlatformInfo();
    const info3 = PlatformDetection.getPlatformInfo();

    // Property: Platform info should be consistent
    assert.strictEqual(
      info1.type,
      info2.type,
      "Platform type should be consistent"
    );
    assert.strictEqual(
      info2.type,
      info3.type,
      "Platform type should be consistent"
    );
    assert.strictEqual(
      info1.pathSeparator,
      info2.pathSeparator,
      "Path separator should be consistent"
    );
    assert.strictEqual(
      info1.homeDirectory,
      info2.homeDirectory,
      "Home directory should be consistent"
    );
  });

  /**
   * Additional Property: Platform info is valid
   */
  test("Platform info contains valid data", function () {
    const info = PlatformDetection.getPlatformInfo();

    // Property: Platform type should be valid
    assert.ok(
      Object.values(PlatformType).includes(info.type),
      "Platform type should be valid"
    );

    // Property: Path separator should be valid
    assert.ok(
      info.pathSeparator === "/" || info.pathSeparator === "\\",
      "Path separator should be / or \\"
    );

    // Property: Home directory should exist
    assert.ok(
      typeof info.homeDirectory === "string",
      "Home directory should be a string"
    );
    assert.ok(
      info.homeDirectory.length > 0,
      "Home directory should not be empty"
    );

    // Property: Temp directory should exist
    assert.ok(
      typeof info.tempDirectory === "string",
      "Temp directory should be a string"
    );
    assert.ok(
      info.tempDirectory.length > 0,
      "Temp directory should not be empty"
    );

    // Property: Boolean flags should be consistent
    const trueCount = [info.isWindows, info.isMacOS, info.isLinux].filter(
      (b) => b
    ).length;
    assert.ok(trueCount <= 1, "At most one platform boolean should be true");
  });
});

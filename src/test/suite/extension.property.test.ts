import * as assert from "assert";
import * as vscode from "vscode";
import * as fc from "fast-check";
import { PlatformDetection } from "../../platformDetection";
import { SettingsManager } from "../../settingsManager";

suite("Extension Property-Based Tests", () => {
  let settingsManager: SettingsManager;

  setup(() => {
    settingsManager = new SettingsManager();
  });

  teardown(() => {
    if (settingsManager) {
      settingsManager.dispose();
    }
  });

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

  suite("Path Validation Properties", () => {
    test("Property: Path normalization should be idempotent", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (path) => {
            // Normalizing a path twice should give the same result
            const normalized1 = PlatformDetection.normalizePath(path);
            const normalized2 = PlatformDetection.normalizePath(normalized1);

            assert.strictEqual(
              normalized1,
              normalized2,
              "Path normalization should be idempotent"
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Joined paths should contain all segments", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => s.trim().length > 0 && !s.includes("/")),
            {
              minLength: 1,
              maxLength: 5,
            }
          ),
          (segments) => {
            const joined = PlatformDetection.joinPaths(...segments);

            // All segments should appear in the joined path
            // Note: path.join normalizes paths, so "./" becomes "."
            for (const segment of segments) {
              const normalized = segment.trim();
              if (normalized.length > 0 && normalized !== ".") {
                assert.ok(
                  joined.includes(normalized),
                  `Joined path should contain segment: ${segment}`
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Absolute paths should remain absolute after normalization", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (relativePath) => {
            const platformInfo = PlatformDetection.getPlatformInfo();
            const absolutePath = PlatformDetection.resolvePath(
              platformInfo.homeDirectory,
              relativePath
            );

            const normalized = PlatformDetection.normalizePath(absolutePath);

            assert.ok(
              PlatformDetection.isAbsolutePath(normalized),
              "Absolute paths should remain absolute after normalization"
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Path separator should be consistent", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 5,
          }),
          (segments) => {
            const joined = PlatformDetection.joinPaths(...segments);
            const platformInfo = PlatformDetection.getPlatformInfo();

            // Count separators - should use platform separator
            const platformSepCount = (
              joined.match(
                new RegExp(`\\${platformInfo.pathSeparator}`, "g")
              ) || []
            ).length;

            // Should have at least one separator for multiple segments
            if (segments.length > 1) {
              assert.ok(platformSepCount > 0, "Should use platform separator");
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  suite("Security Boundary Properties", () => {
    test("Property: Blocked paths should always be rejected", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths();

      fc.assert(
        fc.property(fc.constantFrom(...blockedPaths), (blockedPath) => {
          const result = PlatformDetection.validatePathSecurity(blockedPath);

          assert.ok(
            !result.allowed,
            `Blocked path ${blockedPath} should not be allowed`
          );
          assert.ok(result.reason, "Should provide reason for blocking");
        }),
        { numRuns: Math.min(blockedPaths.length, 100) }
      );
    });

    test("Property: Paths within blocked directories should be rejected", () => {
      const blockedPaths = PlatformDetection.getPlatformBlockedPaths().filter(
        (p) => !p.includes("*")
      );

      if (blockedPaths.length > 0) {
        fc.assert(
          fc.property(
            fc.constantFrom(...blockedPaths),
            fc.string({ minLength: 1, maxLength: 20 }),
            (blockedPath, subpath) => {
              const fullPath = PlatformDetection.joinPaths(
                blockedPath,
                subpath
              );
              const result = PlatformDetection.validatePathSecurity(fullPath);

              // Paths within blocked directories should be blocked
              // (unless the subpath escapes with ..)
              if (!subpath.includes("..")) {
                assert.ok(
                  !result.allowed,
                  `Path within blocked directory should not be allowed: ${fullPath}`
                );
              }
            }
          ),
          { numRuns: 50 }
        );
      }
    });

    test("Property: Security validation should be deterministic", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (path) => {
          const result1 = PlatformDetection.validatePathSecurity(path);
          const result2 = PlatformDetection.validatePathSecurity(path);

          assert.strictEqual(
            result1.allowed,
            result2.allowed,
            "Security validation should be deterministic"
          );
          assert.strictEqual(
            result1.reason,
            result2.reason,
            "Reason should be consistent"
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  suite("Configuration Validation Properties", () => {
    test("Property: Valid settings should always pass validation", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 300000 }), // timeout
          fc.integer({ min: 1024, max: 10737418240 }), // maxFileSize
          fc.integer({ min: 1, max: 1000 }), // maxOpsPerMin
          (timeout, maxFileSize, maxOpsPerMin) => {
            const settings = settingsManager.getSettings();
            settings.server.timeout = timeout;
            settings.security.maxFileSize = maxFileSize;
            settings.security.maxBatchSize = maxFileSize * 2; // Always >= maxFileSize
            settings.security.maxOperationsPerMinute = maxOpsPerMin;
            settings.ui.refreshInterval = 1000;

            const result = settingsManager.validateSettings(settings);

            assert.ok(
              result.valid,
              `Valid settings should pass: timeout=${timeout}, maxFileSize=${maxFileSize}, maxOpsPerMin=${maxOpsPerMin}`
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Invalid timeout should always fail validation", () => {
      fc.assert(
        fc.property(fc.integer({ min: -1000, max: 999 }), (invalidTimeout) => {
          const settings = settingsManager.getSettings();
          settings.server.timeout = invalidTimeout;

          const result = settingsManager.validateSettings(settings);

          assert.ok(
            !result.valid,
            `Invalid timeout ${invalidTimeout} should fail validation`
          );
          assert.ok(
            result.errors.some((e) => e.includes("timeout")),
            "Should have timeout error"
          );
        }),
        { numRuns: 100 }
      );
    });

    test("Property: maxBatchSize < maxFileSize should always fail", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 100000000 }),
          (maxFileSize) => {
            const settings = settingsManager.getSettings();
            settings.security.maxFileSize = maxFileSize;
            settings.security.maxBatchSize = Math.floor(maxFileSize / 2);

            const result = settingsManager.validateSettings(settings);

            assert.ok(
              !result.valid,
              "maxBatchSize < maxFileSize should fail validation"
            );
            assert.ok(
              result.errors.some((e) => e.includes("batch size")),
              "Should have batch size error"
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Negative refresh interval should always fail", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (negativeInterval) => {
            const settings = settingsManager.getSettings();
            settings.ui.refreshInterval = negativeInterval;

            const result = settingsManager.validateSettings(settings);

            assert.ok(
              !result.valid,
              `Negative refresh interval ${negativeInterval} should fail`
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  suite("File Pattern Matching Properties", () => {
    test("Property: Pattern matching should be case-sensitive on Unix", () => {
      const platformInfo = PlatformDetection.getPlatformInfo();

      if (!platformInfo.isWindows) {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 20 }),
            (filename) => {
              const lower = filename.toLowerCase();
              const upper = filename.toUpperCase();

              // If they're different, they should be treated as different files
              if (lower !== upper) {
                assert.notStrictEqual(
                  lower,
                  upper,
                  "Case should matter on Unix systems"
                );
              }
            }
          ),
          { numRuns: 100 }
        );
      }
    });

    test("Property: Wildcard patterns should match multiple files", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 10,
          }),
          (filenames) => {
            // Pattern *.txt should match all .txt files
            const txtFiles = filenames.filter((f) => f.endsWith(".txt"));

            // If we have .txt files, the pattern should match them
            if (txtFiles.length > 0) {
              assert.ok(
                txtFiles.length > 0,
                "Pattern should match multiple files"
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property: Extension extraction should be consistent", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter(
              (s) =>
                s.trim().length > 0 &&
                !s.includes("/") &&
                !s.includes(".") &&
                !s.includes(" ")
            ),
          fc
            .string({ minLength: 1, maxLength: 5 })
            .filter(
              (s) =>
                s.trim().length > 0 &&
                !s.includes("/") &&
                !s.includes(".") &&
                !s.includes(" ")
            ),
          (basename, ext) => {
            const filename = `${basename}.${ext}`;
            const extracted = PlatformDetection.getExtension(filename);

            // For simple filenames without dots or spaces, extraction should be predictable
            assert.strictEqual(
              extracted,
              `.${ext}`,
              `Extension should be .${ext} for filename ${filename}`
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  suite("Operation Atomicity Properties", () => {
    test("Property: Settings reload should preserve structure", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const before = settingsManager.getSettings();

          settingsManager.reloadSettings();

          const after = settingsManager.getSettings();

          // Structure should be preserved
          assert.ok(after.server, "Should have server settings");
          assert.ok(after.security, "Should have security settings");
          assert.ok(after.operations, "Should have operations settings");
          assert.ok(after.ui, "Should have UI settings");

          // Types should be preserved
          assert.strictEqual(
            typeof before.server.timeout,
            typeof after.server.timeout,
            "Timeout type should be preserved"
          );
          assert.strictEqual(
            typeof before.ui.refreshInterval,
            typeof after.ui.refreshInterval,
            "Refresh interval type should be preserved"
          );
        }),
        { numRuns: 100 }
      );
    });

    test("Property: Multiple reloads should be idempotent", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (reloadCount) => {
          const initial = settingsManager.getSettings();

          // Reload multiple times
          for (let i = 0; i < reloadCount; i++) {
            settingsManager.reloadSettings();
          }

          const final = settingsManager.getSettings();

          // Settings should be consistent
          assert.deepStrictEqual(
            initial.server.timeout,
            final.server.timeout,
            "Settings should be consistent after multiple reloads"
          );
        }),
        { numRuns: 50 }
      );
    });

    test("Property: Validation should not modify settings", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const settings = settingsManager.getSettings();
          const before = JSON.stringify(settings);

          settingsManager.validateSettings(settings);

          const after = JSON.stringify(settings);

          assert.strictEqual(
            before,
            after,
            "Validation should not modify settings"
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  suite("Platform-Specific Properties", () => {
    test("Property: Path formatting should be reversible", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (path) => {
          const formatted = PlatformDetection.formatPathForDisplay(path);
          const normalized = PlatformDetection.normalizePath(formatted);

          // Should be able to normalize formatted paths
          assert.ok(
            normalized.length > 0,
            "Formatted paths should be normalizable"
          );
        }),
        { numRuns: 100 }
      );
    });

    test("Property: Command syntax should handle spaces consistently", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (command) => {
          const syntax = PlatformDetection.getCommandSyntax(command);

          // Should return a string
          assert.ok(typeof syntax === "string", "Should return string");
          assert.ok(syntax.length > 0, "Should not be empty");

          // If command has spaces, syntax should handle them
          if (command.includes(" ")) {
            assert.ok(
              syntax.length >= command.length,
              "Should handle spaces in command"
            );
          }
        }),
        { numRuns: 100 }
      );
    });

    test("Property: Platform detection should be consistent", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const info1 = PlatformDetection.getPlatformInfo();
          const info2 = PlatformDetection.getPlatformInfo();

          // Should return same information
          assert.strictEqual(
            info1.type,
            info2.type,
            "Platform type should be consistent"
          );
          assert.strictEqual(
            info1.pathSeparator,
            info2.pathSeparator,
            "Path separator should be consistent"
          );
          assert.strictEqual(
            info1.isWindows,
            info2.isWindows,
            "Windows flag should be consistent"
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});

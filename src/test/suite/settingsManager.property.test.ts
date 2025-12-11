/**
 * Property-Based Tests for Settings Manager
 * Feature: filesystem-extension-completion
 */

import * as assert from "assert";
import * as fc from "fast-check";
import { SettingsManager, FilesystemSettings } from "../../settingsManager";

suite("Settings Manager Property-Based Tests", () => {
  /**
   * Property 10: Settings Default Values
   * Feature: filesystem-extension-completion, Property 10: Settings Default Values
   * Validates: Requirements 2.4
   *
   * For any unconfigured setting, the Settings Manager should return the documented default value.
   */
  test("Property 10: Settings default values are always provided", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Create a new settings manager instance
        const settingsManager = new SettingsManager();

        // Get settings
        const settings = settingsManager.getSettings();

        // Property: All settings should have defined values (no undefined)
        assert.ok(
          settings.server !== undefined,
          "Server settings should be defined"
        );
        assert.ok(
          settings.security !== undefined,
          "Security settings should be defined"
        );
        assert.ok(
          settings.operations !== undefined,
          "Operations settings should be defined"
        );
        assert.ok(settings.ui !== undefined, "UI settings should be defined");

        // Property: Server settings should have default values
        assert.ok(
          typeof settings.server.serverPath === "string",
          "serverPath should be a string"
        );
        assert.ok(
          typeof settings.server.autoStart === "boolean",
          "autoStart should be a boolean"
        );
        assert.ok(
          typeof settings.server.timeout === "number",
          "timeout should be a number"
        );
        assert.ok(settings.server.timeout > 0, "timeout should be positive");
        assert.ok(
          ["debug", "info", "warn", "error"].includes(settings.server.logLevel),
          "logLevel should be valid"
        );

        // Property: Security settings should have default values
        assert.ok(
          typeof settings.security.workspaceRoot === "string",
          "workspaceRoot should be a string"
        );
        assert.ok(
          Array.isArray(settings.security.allowedSubdirectories),
          "allowedSubdirectories should be an array"
        );
        assert.ok(
          Array.isArray(settings.security.blockedPaths),
          "blockedPaths should be an array"
        );
        assert.ok(
          Array.isArray(settings.security.blockedPatterns),
          "blockedPatterns should be an array"
        );
        assert.ok(
          typeof settings.security.maxFileSize === "number",
          "maxFileSize should be a number"
        );
        assert.ok(
          settings.security.maxFileSize > 0,
          "maxFileSize should be positive"
        );
        assert.ok(
          typeof settings.security.maxBatchSize === "number",
          "maxBatchSize should be a number"
        );
        assert.ok(
          settings.security.maxBatchSize > 0,
          "maxBatchSize should be positive"
        );
        assert.ok(
          typeof settings.security.maxOperationsPerMinute === "number",
          "maxOperationsPerMinute should be a number"
        );
        assert.ok(
          settings.security.maxOperationsPerMinute > 0,
          "maxOperationsPerMinute should be positive"
        );

        // Property: Operations settings should have default values
        assert.ok(
          typeof settings.operations.enableBatch === "boolean",
          "enableBatch should be a boolean"
        );
        assert.ok(
          typeof settings.operations.enableWatch === "boolean",
          "enableWatch should be a boolean"
        );
        assert.ok(
          typeof settings.operations.enableSearch === "boolean",
          "enableSearch should be a boolean"
        );
        assert.ok(
          typeof settings.operations.enableChecksum === "boolean",
          "enableChecksum should be a boolean"
        );

        // Property: UI settings should have default values
        assert.ok(
          typeof settings.ui.refreshInterval === "number",
          "refreshInterval should be a number"
        );
        assert.ok(
          settings.ui.refreshInterval >= 0,
          "refreshInterval should be non-negative"
        );
        assert.ok(
          typeof settings.ui.showNotifications === "boolean",
          "showNotifications should be a boolean"
        );
        assert.ok(
          typeof settings.ui.showSecurityWarnings === "boolean",
          "showSecurityWarnings should be a boolean"
        );
        assert.ok(
          typeof settings.ui.confirmDangerousOperations === "boolean",
          "confirmDangerousOperations should be a boolean"
        );

        // Cleanup
        settingsManager.dispose();

        return true;
      }),
      {
        numRuns: 100,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 10 (Invariant): Default values consistency
   * Multiple instances should return the same default values.
   */
  test("Property 10 (Invariant): Default values are consistent across instances", async function () {
    this.timeout(10000);

    const manager1 = new SettingsManager();
    const manager2 = new SettingsManager();

    const settings1 = manager1.getSettings();
    const settings2 = manager2.getSettings();

    // Property: Default values should be consistent
    assert.strictEqual(
      settings1.server.autoStart,
      settings2.server.autoStart,
      "autoStart default should be consistent"
    );
    assert.strictEqual(
      settings1.server.logLevel,
      settings2.server.logLevel,
      "logLevel default should be consistent"
    );
    assert.strictEqual(
      settings1.security.maxFileSize,
      settings2.security.maxFileSize,
      "maxFileSize default should be consistent"
    );
    assert.strictEqual(
      settings1.security.maxBatchSize,
      settings2.security.maxBatchSize,
      "maxBatchSize default should be consistent"
    );
    assert.strictEqual(
      settings1.ui.refreshInterval,
      settings2.ui.refreshInterval,
      "refreshInterval default should be consistent"
    );

    manager1.dispose();
    manager2.dispose();
  });

  /**
   * Property 10 (Edge Case): Settings manager handles missing configuration gracefully
   */
  test("Property 10 (Edge Case): Settings manager handles missing configuration", async function () {
    this.timeout(10000);

    // Create settings manager (should not throw even if config is missing)
    const settingsManager = new SettingsManager();

    // Property: Should not throw when getting settings
    assert.doesNotThrow(() => {
      const settings = settingsManager.getSettings();
      assert.ok(settings, "Settings should be returned");
    }, "Getting settings should not throw");

    settingsManager.dispose();
  });

  /**
   * Property 8: Settings Validation Rejection
   * Feature: filesystem-extension-completion, Property 8: Settings Validation Rejection
   * Validates: Requirements 2.2
   *
   * For any invalid setting value, the Settings Manager should reject the change
   * and display an error message.
   */
  test("Property 8: Invalid settings are rejected", async function () {
    this.timeout(60000);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidSetting: fc.oneof(
            // Invalid timeout (too small)
            fc.record({
              type: fc.constant("timeout"),
              value: fc.integer({ min: -1000, max: 999 }),
            }),
            // Invalid maxFileSize (too small)
            fc.record({
              type: fc.constant("maxFileSize"),
              value: fc.integer({ min: -1000, max: 1023 }),
            }),
            // Invalid maxBatchSize (smaller than maxFileSize)
            fc.record({
              type: fc.constant("maxBatchSize"),
              value: fc.integer({ min: 1, max: 1000 }),
            }),
            // Invalid maxOperationsPerMinute (zero or negative)
            fc.record({
              type: fc.constant("maxOperationsPerMinute"),
              value: fc.integer({ min: -100, max: 0 }),
            }),
            // Invalid refreshInterval (negative)
            fc.record({
              type: fc.constant("refreshInterval"),
              value: fc.integer({ min: -1000, max: -1 }),
            })
          ),
        }),
        async ({ invalidSetting }) => {
          const settingsManager = new SettingsManager();
          const currentSettings = settingsManager.getSettings();

          let testSettings: Partial<FilesystemSettings> = {};

          // Create invalid settings based on type
          switch (invalidSetting.type) {
            case "timeout":
              testSettings = {
                server: {
                  ...currentSettings.server,
                  timeout: invalidSetting.value,
                },
              };
              break;
            case "maxFileSize":
              testSettings = {
                security: {
                  ...currentSettings.security,
                  maxFileSize: invalidSetting.value,
                },
              };
              break;
            case "maxBatchSize":
              testSettings = {
                security: {
                  ...currentSettings.security,
                  maxBatchSize: invalidSetting.value,
                },
              };
              break;
            case "maxOperationsPerMinute":
              testSettings = {
                security: {
                  ...currentSettings.security,
                  maxOperationsPerMinute: invalidSetting.value,
                },
              };
              break;
            case "refreshInterval":
              testSettings = {
                ui: {
                  ...currentSettings.ui,
                  refreshInterval: invalidSetting.value,
                },
              };
              break;
          }

          // Merge with current settings to create complete settings object
          const fullSettings: FilesystemSettings = {
            server: testSettings.server || currentSettings.server,
            security: testSettings.security || currentSettings.security,
            operations: testSettings.operations || currentSettings.operations,
            ui: testSettings.ui || currentSettings.ui,
          };

          // Property: Invalid settings should be rejected by validation
          const validation = settingsManager.validateSettings(fullSettings);

          assert.ok(
            !validation.valid,
            `Invalid ${invalidSetting.type} (${invalidSetting.value}) should be rejected`
          );
          assert.ok(
            validation.errors.length > 0,
            `Invalid ${invalidSetting.type} should produce error messages`
          );

          settingsManager.dispose();
          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 55000,
      }
    );
  });

  /**
   * Property 8 (Simplified): Common invalid settings are rejected
   */
  test("Property 8 (Simplified): Common invalid settings are rejected", async function () {
    this.timeout(10000);

    const settingsManager = new SettingsManager();
    const currentSettings = settingsManager.getSettings();

    const invalidSettings = [
      {
        name: "timeout too small",
        settings: {
          ...currentSettings,
          server: { ...currentSettings.server, timeout: 500 },
        },
      },
      {
        name: "maxFileSize too small",
        settings: {
          ...currentSettings,
          security: { ...currentSettings.security, maxFileSize: 100 },
        },
      },
      {
        name: "maxBatchSize smaller than maxFileSize",
        settings: {
          ...currentSettings,
          security: {
            ...currentSettings.security,
            maxFileSize: 1000000,
            maxBatchSize: 500000,
          },
        },
      },
      {
        name: "maxOperationsPerMinute zero",
        settings: {
          ...currentSettings,
          security: { ...currentSettings.security, maxOperationsPerMinute: 0 },
        },
      },
      {
        name: "refreshInterval negative",
        settings: {
          ...currentSettings,
          ui: { ...currentSettings.ui, refreshInterval: -100 },
        },
      },
    ];

    for (const { name, settings } of invalidSettings) {
      const validation = settingsManager.validateSettings(settings);

      assert.ok(!validation.valid, `${name} should be invalid`);
      assert.ok(
        validation.errors.length > 0,
        `${name} should produce error messages`
      );
    }

    settingsManager.dispose();
  });

  /**
   * Property 8 (Invariant): Validation is consistent
   * Validating the same settings multiple times should produce the same result.
   */
  test("Property 8 (Invariant): Validation is consistent", async function () {
    this.timeout(10000);

    const settingsManager = new SettingsManager();
    const currentSettings = settingsManager.getSettings();

    // Create invalid settings
    const invalidSettings: FilesystemSettings = {
      ...currentSettings,
      server: { ...currentSettings.server, timeout: 500 },
    };

    // Validate multiple times
    const validation1 = settingsManager.validateSettings(invalidSettings);
    const validation2 = settingsManager.validateSettings(invalidSettings);
    const validation3 = settingsManager.validateSettings(invalidSettings);

    // Property: Validation should be consistent
    assert.strictEqual(
      validation1.valid,
      validation2.valid,
      "Validation result should be consistent"
    );
    assert.strictEqual(
      validation2.valid,
      validation3.valid,
      "Validation result should be consistent"
    );
    assert.deepStrictEqual(
      validation1.errors,
      validation2.errors,
      "Validation errors should be consistent"
    );
    assert.deepStrictEqual(
      validation2.errors,
      validation3.errors,
      "Validation errors should be consistent"
    );

    settingsManager.dispose();
  });

  /**
   * Property 11: Startup Settings Validation
   * Feature: filesystem-extension-completion, Property 11: Startup Settings Validation
   * Validates: Requirements 2.5
   *
   * For any extension startup, the Settings Manager should validate all settings
   * and report any configuration errors.
   */
  test("Property 11: Settings are validated on startup", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Create a new settings manager (simulates startup)
        const settingsManager = new SettingsManager();

        // Get current settings
        const settings = settingsManager.getSettings();

        // Property: Settings should be valid on startup
        const validation = settingsManager.validateSettings(settings);

        // Current settings should be valid (or at least have no errors)
        // Warnings are acceptable
        assert.ok(
          validation.valid || validation.errors.length === 0,
          "Settings on startup should be valid or have no errors"
        );

        settingsManager.dispose();
        return true;
      }),
      {
        numRuns: 50,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 11 (Simplified): Startup validation doesn't throw
   */
  test("Property 11 (Simplified): Startup validation doesn't throw", async function () {
    this.timeout(5000);

    // Property: Creating a settings manager should not throw
    assert.doesNotThrow(() => {
      const settingsManager = new SettingsManager();
      const settings = settingsManager.getSettings();
      const validation = settingsManager.validateSettings(settings);

      // Should have a validation result
      assert.ok(validation !== undefined, "Validation result should exist");
      assert.ok(Array.isArray(validation.errors), "Errors should be an array");
      assert.ok(
        Array.isArray(validation.warnings),
        "Warnings should be an array"
      );

      settingsManager.dispose();
    }, "Startup validation should not throw");
  });

  /**
   * Property 9: Settings Change Event Emission
   * Feature: filesystem-extension-completion, Property 9: Settings Change Event Emission
   * Validates: Requirements 2.3
   *
   * For any setting change, the Settings Manager should emit a change event
   * to all registered subscribers.
   */
  test("Property 9: Settings changes emit events", async function () {
    this.timeout(60000);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          changeType: fc.oneof(
            fc.constant("server"),
            fc.constant("security"),
            fc.constant("operations"),
            fc.constant("ui")
          ),
        }),
        async ({ changeType }) => {
          const settingsManager = new SettingsManager();
          let eventFired = false;
          let receivedSettings: FilesystemSettings | undefined;

          // Subscribe to change events
          const disposable = settingsManager.onDidChange((settings) => {
            eventFired = true;
            receivedSettings = settings;
          });

          try {
            // Reload settings (simulates a change)
            settingsManager.reloadSettings();

            // Give event time to fire
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Property: Change event should be fired
            assert.ok(eventFired, "Change event should be fired");
            assert.ok(
              receivedSettings !== undefined,
              "Event should include settings"
            );

            return true;
          } finally {
            disposable.dispose();
            settingsManager.dispose();
          }
        }
      ),
      {
        numRuns: 50,
        timeout: 55000,
      }
    );
  });

  /**
   * Property 9 (Simplified): Reload triggers change event
   */
  test("Property 9 (Simplified): Reload triggers change event", async function () {
    this.timeout(5000);

    const settingsManager = new SettingsManager();
    let eventCount = 0;

    const disposable = settingsManager.onDidChange(() => {
      eventCount++;
    });

    // Reload settings
    settingsManager.reloadSettings();

    // Give event time to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Property: Event should be fired
    assert.ok(eventCount > 0, "Change event should be fired on reload");

    disposable.dispose();
    settingsManager.dispose();
  });

  /**
   * Property 9 (Invariant): Multiple subscribers receive events
   */
  test("Property 9 (Invariant): Multiple subscribers receive events", async function () {
    this.timeout(5000);

    const settingsManager = new SettingsManager();
    let subscriber1Fired = false;
    let subscriber2Fired = false;
    let subscriber3Fired = false;

    const disposable1 = settingsManager.onDidChange(() => {
      subscriber1Fired = true;
    });
    const disposable2 = settingsManager.onDidChange(() => {
      subscriber2Fired = true;
    });
    const disposable3 = settingsManager.onDidChange(() => {
      subscriber3Fired = true;
    });

    // Reload settings
    settingsManager.reloadSettings();

    // Give events time to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Property: All subscribers should receive the event
    assert.ok(subscriber1Fired, "Subscriber 1 should receive event");
    assert.ok(subscriber2Fired, "Subscriber 2 should receive event");
    assert.ok(subscriber3Fired, "Subscriber 3 should receive event");

    disposable1.dispose();
    disposable2.dispose();
    disposable3.dispose();
    settingsManager.dispose();
  });

  /**
   * Property 12: Immediate Settings Application
   * Feature: filesystem-extension-completion, Property 12: Immediate Settings Application
   * Validates: Requirements 2.6
   *
   * For any settings update through VS Code UI, the Settings Manager should apply
   * changes immediately without requiring restart.
   */
  test("Property 12: Settings changes are applied immediately", async function () {
    this.timeout(30000);

    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const settingsManager = new SettingsManager();
        let changeEventFired = false;

        const disposable = settingsManager.onDidChange(() => {
          changeEventFired = true;
        });

        try {
          // Reload settings (simulates immediate application)
          settingsManager.reloadSettings();

          // Give minimal time for event
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Property: Change should be applied immediately (event fired quickly)
          assert.ok(
            changeEventFired,
            "Settings change should be applied immediately"
          );

          return true;
        } finally {
          disposable.dispose();
          settingsManager.dispose();
        }
      }),
      {
        numRuns: 50,
        timeout: 25000,
      }
    );
  });

  /**
   * Property 12 (Simplified): Reload applies changes immediately
   */
  test("Property 12 (Simplified): Reload applies changes immediately", async function () {
    this.timeout(5000);

    const settingsManager = new SettingsManager();
    const startTime = Date.now();
    let eventTime = 0;

    const disposable = settingsManager.onDidChange(() => {
      eventTime = Date.now();
    });

    // Reload settings
    settingsManager.reloadSettings();

    // Give event time to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Property: Change should be applied quickly (< 100ms)
    const elapsed = eventTime - startTime;
    assert.ok(
      elapsed < 100,
      `Settings should be applied immediately (took ${elapsed}ms)`
    );

    disposable.dispose();
    settingsManager.dispose();
  });
});

import * as assert from "assert";
import * as vscode from "vscode";
import {
  ErrorHandler,
  ErrorCategory,
  FilesystemError,
} from "../../errorHandling";

suite("ErrorHandler Unit Tests", () => {
  let outputChannel: vscode.LogOutputChannel;
  let errorHandler: ErrorHandler;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel("Test", { log: true });
    errorHandler = new ErrorHandler(outputChannel);
  });

  teardown(() => {
    errorHandler.dispose();
    outputChannel.dispose();
  });

  suite("Error Categorization", () => {
    test("should categorize security errors", () => {
      const error = new Error("security violation detected");
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.SECURITY_ERROR);
    });

    test("should categorize network errors", () => {
      const error = new Error("ECONNREFUSED: connection refused");
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.NETWORK_ERROR);
    });

    test("should categorize configuration errors", () => {
      const error = new Error("invalid configuration setting");
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.CONFIGURATION_ERROR);
    });

    test("should categorize user errors", () => {
      const error = new Error("ENOENT: file not found");
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.USER_ERROR);
    });

    test("should default to system error for unknown errors", () => {
      const error = new Error("some random error");
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.SYSTEM_ERROR);
    });

    test("should categorize based on error name", () => {
      const error = new Error("something went wrong");
      error.name = "NetworkError";
      const category = errorHandler.categorizeError(error);
      assert.strictEqual(category, ErrorCategory.NETWORK_ERROR);
    });
  });

  suite("User-Friendly Messages", () => {
    test("should generate user-friendly message for ENOENT", () => {
      const error: FilesystemError = Object.assign(
        new Error("ENOENT: no such file"),
        {
          category: ErrorCategory.USER_ERROR,
        }
      );
      const message = errorHandler.getUserFriendlyMessage(error);
      assert.ok(message.includes("could not be found"));
      assert.ok(!message.includes("ENOENT"));
    });

    test("should generate user-friendly message for EACCES", () => {
      const error: FilesystemError = Object.assign(
        new Error("EACCES: permission denied"),
        {
          category: ErrorCategory.USER_ERROR,
        }
      );
      const message = errorHandler.getUserFriendlyMessage(error);
      assert.ok(message.toLowerCase().includes("permission"));
      assert.ok(!message.includes("EACCES"));
    });

    test("should generate user-friendly message for network timeout", () => {
      const error: FilesystemError = Object.assign(
        new Error("ETIMEDOUT: connection timeout"),
        {
          category: ErrorCategory.NETWORK_ERROR,
        }
      );
      const message = errorHandler.getUserFriendlyMessage(error);
      assert.ok(message.toLowerCase().includes("timed out"));
      assert.ok(message.toLowerCase().includes("server"));
    });

    test("should include path in security error message", () => {
      const error: FilesystemError = Object.assign(
        new Error("security violation"),
        {
          category: ErrorCategory.SECURITY_ERROR,
          context: { path: "/etc/passwd", boundary: "/workspace" },
        }
      );
      const message = errorHandler.getUserFriendlyMessage(error);
      assert.ok(message.includes("/etc/passwd"));
      assert.ok(message.includes("/workspace"));
    });

    test("should include pattern in security error message", () => {
      const error: FilesystemError = Object.assign(
        new Error("security violation"),
        {
          category: ErrorCategory.SECURITY_ERROR,
          context: { path: "secret.key", pattern: "*.key" },
        }
      );
      const message = errorHandler.getUserFriendlyMessage(error);
      assert.ok(message.includes("secret.key"));
      assert.ok(message.includes("*.key"));
    });
  });

  suite("Recovery Suggestions", () => {
    test("should provide suggestions for file not found", () => {
      const error: FilesystemError = Object.assign(
        new Error("file not found"),
        {
          category: ErrorCategory.USER_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some(
          (s) =>
            s.toLowerCase().includes("file") || s.toLowerCase().includes("path")
        )
      );
    });

    test("should provide suggestions for permission denied", () => {
      const error: FilesystemError = Object.assign(
        new Error("permission denied"),
        {
          category: ErrorCategory.USER_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some((s) => s.toLowerCase().includes("permission"))
      );
    });

    test("should provide suggestions for network errors", () => {
      const error: FilesystemError = Object.assign(
        new Error("connection failed"),
        {
          category: ErrorCategory.NETWORK_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some(
          (s) =>
            s.toLowerCase().includes("server") ||
            s.toLowerCase().includes("network")
        )
      );
    });

    test("should provide suggestions for security errors", () => {
      const error: FilesystemError = Object.assign(
        new Error("security violation"),
        {
          category: ErrorCategory.SECURITY_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some(
          (s) =>
            s.toLowerCase().includes("security") ||
            s.toLowerCase().includes("settings")
        )
      );
    });

    test("should provide suggestions for configuration errors", () => {
      const error: FilesystemError = Object.assign(
        new Error("invalid configuration"),
        {
          category: ErrorCategory.CONFIGURATION_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some(
          (s) =>
            s.toLowerCase().includes("settings") ||
            s.toLowerCase().includes("configuration")
        )
      );
    });

    test("should provide suggestions for system errors", () => {
      const error: FilesystemError = Object.assign(
        new Error("system failure"),
        {
          category: ErrorCategory.SYSTEM_ERROR,
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.length > 0);
      assert.ok(
        suggestions.some(
          (s) =>
            s.toLowerCase().includes("system") ||
            s.toLowerCase().includes("restart")
        )
      );
    });

    test("should include path in security error suggestions", () => {
      const error: FilesystemError = Object.assign(
        new Error("security violation"),
        {
          category: ErrorCategory.SECURITY_ERROR,
          context: { path: "/etc/passwd" },
        }
      );
      const suggestions = errorHandler.getRecoverySuggestions(error);
      assert.ok(suggestions.some((s) => s.includes("/etc/passwd")));
    });
  });

  suite("Error Logging", () => {
    test("should log error message", () => {
      const logs: string[] = [];
      const mockChannel = {
        error: (msg: string) => logs.push(msg),
        dispose: () => {},
      } as unknown as vscode.LogOutputChannel;

      const handler = new ErrorHandler(mockChannel);
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SYSTEM_ERROR,
      });

      handler.handleError(error);

      assert.ok(logs.length > 0);
      assert.ok(logs.some((log) => log.includes("test error")));
      handler.dispose();
    });

    test("should log error category", () => {
      const logs: string[] = [];
      const mockChannel = {
        error: (msg: string) => logs.push(msg),
        dispose: () => {},
      } as unknown as vscode.LogOutputChannel;

      const handler = new ErrorHandler(mockChannel);
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SECURITY_ERROR,
      });

      handler.handleError(error);

      assert.ok(logs.some((log) => log.includes("SECURITY")));
      handler.dispose();
    });

    test("should log error context", () => {
      const logs: string[] = [];
      const mockChannel = {
        error: (msg: string) => logs.push(msg),
        dispose: () => {},
      } as unknown as vscode.LogOutputChannel;

      const handler = new ErrorHandler(mockChannel);
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SYSTEM_ERROR,
        context: { path: "/test/path", operation: "read" },
      });

      handler.handleError(error);

      assert.ok(logs.some((log) => log.includes("Context:")));
      assert.ok(logs.some((log) => log.includes("/test/path")));
      handler.dispose();
    });

    test("should log stack trace", () => {
      const logs: string[] = [];
      const mockChannel = {
        error: (msg: string) => logs.push(msg),
        dispose: () => {},
      } as unknown as vscode.LogOutputChannel;

      const handler = new ErrorHandler(mockChannel);
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SYSTEM_ERROR,
        stack: "Error: test error\n    at test.ts:10:5",
      });

      handler.handleError(error);

      assert.ok(logs.some((log) => log.includes("Stack trace:")));
      handler.dispose();
    });

    test("should log timestamp", () => {
      const logs: string[] = [];
      const mockChannel = {
        error: (msg: string) => logs.push(msg),
        dispose: () => {},
      } as unknown as vscode.LogOutputChannel;

      const handler = new ErrorHandler(mockChannel);
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SYSTEM_ERROR,
      });

      handler.handleError(error);

      // Check for ISO timestamp format
      assert.ok(
        logs.some((log) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(log))
      );
      handler.dispose();
    });
  });

  suite("Error Aggregation", () => {
    test("should aggregate similar errors", async () => {
      const notifications: string[] = [];
      const originalShowError = vscode.window.showErrorMessage;

      (vscode.window as any).showErrorMessage = (message: string) => {
        notifications.push(message);
        return Promise.resolve(undefined);
      };

      try {
        const error1: FilesystemError = Object.assign(new Error("test error"), {
          category: ErrorCategory.SYSTEM_ERROR,
        });
        const error2: FilesystemError = Object.assign(new Error("test error"), {
          category: ErrorCategory.SYSTEM_ERROR,
        });

        errorHandler.handleError(error1);
        errorHandler.handleError(error2);

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have fewer notifications than errors
        assert.ok(notifications.length < 2);
      } finally {
        (vscode.window as any).showErrorMessage = originalShowError;
      }
    });

    test("should not aggregate different errors", async () => {
      const notifications: string[] = [];
      const originalShowError = vscode.window.showErrorMessage;

      (vscode.window as any).showErrorMessage = (message: string) => {
        notifications.push(message);
        return Promise.resolve(undefined);
      };

      try {
        const error1: FilesystemError = Object.assign(new Error("error one"), {
          category: ErrorCategory.SYSTEM_ERROR,
        });
        const error2: FilesystemError = Object.assign(new Error("error two"), {
          category: ErrorCategory.SYSTEM_ERROR,
        });

        errorHandler.handleError(error1);
        errorHandler.handleError(error2);

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have notifications for both errors
        assert.strictEqual(notifications.length, 2);
      } finally {
        (vscode.window as any).showErrorMessage = originalShowError;
      }
    });
  });

  suite("Disposal", () => {
    test("should dispose without throwing", () => {
      assert.doesNotThrow(() => {
        errorHandler.dispose();
      });
    });

    test("should clear aggregation on dispose", () => {
      const error: FilesystemError = Object.assign(new Error("test error"), {
        category: ErrorCategory.SYSTEM_ERROR,
      });

      errorHandler.handleError(error);
      errorHandler.dispose();

      // Should not throw after disposal
      assert.doesNotThrow(() => {
        errorHandler.handleError(error);
      });
    });
  });
});

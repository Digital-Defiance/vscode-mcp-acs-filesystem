import * as vscode from "vscode";

/**
 * Error category enum
 * Categorizes errors by their nature for appropriate handling
 */
export enum ErrorCategory {
  USER_ERROR = "user",
  SYSTEM_ERROR = "system",
  NETWORK_ERROR = "network",
  SECURITY_ERROR = "security",
  CONFIGURATION_ERROR = "configuration",
}

/**
 * Filesystem error interface
 * Extends standard Error with categorization and context
 */
export interface FilesystemError extends Error {
  category: ErrorCategory;
  context?: Record<string, unknown>;
  originalError?: Error;
}

/**
 * Error aggregation entry
 */
interface ErrorAggregationEntry {
  error: FilesystemError;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

/**
 * Error Handler class
 * Provides centralized error handling with categorization, user-friendly messages,
 * and recovery suggestions
 */
export class ErrorHandler {
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly aggregationWindow = 5000; // 5 seconds
  private readonly errorAggregation = new Map<string, ErrorAggregationEntry>();

  constructor(outputChannel: vscode.LogOutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Handle an error
   * Categorizes, logs, and displays appropriate messages to the user
   */
  public handleError(error: FilesystemError): void {
    // Ensure error has a category
    if (!error.category) {
      error.category = this.categorizeError(error);
    }

    // Log the error
    this.logError(error);

    // Check if we should aggregate this error
    const errorKey = this.getErrorKey(error);
    const aggregated = this.aggregateError(errorKey, error);

    if (!aggregated) {
      // Show user-friendly message
      const message = this.getUserFriendlyMessage(error);
      const suggestions = this.getRecoverySuggestions(error);

      if (suggestions.length > 0) {
        this.showErrorWithSuggestions(message, suggestions);
      } else {
        this.showError(error.category, message);
      }
    }
  }

  /**
   * Categorize an error
   * Determines the error category based on error properties
   */
  public categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Security errors
    if (
      message.includes("security") ||
      message.includes("blocked") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("boundary")
    ) {
      return ErrorCategory.SECURITY_ERROR;
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      name.includes("network")
    ) {
      return ErrorCategory.NETWORK_ERROR;
    }

    // Configuration errors
    if (
      message.includes("configuration") ||
      message.includes("config") ||
      message.includes("setting") ||
      message.includes("invalid setting")
    ) {
      return ErrorCategory.CONFIGURATION_ERROR;
    }

    // User errors
    if (
      message.includes("invalid") ||
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("enoent") ||
      message.includes("permission denied") ||
      message.includes("eacces")
    ) {
      return ErrorCategory.USER_ERROR;
    }

    // Default to system error
    return ErrorCategory.SYSTEM_ERROR;
  }

  /**
   * Get user-friendly error message
   * Converts technical errors into understandable messages
   */
  public getUserFriendlyMessage(error: FilesystemError): string {
    switch (error.category) {
      case ErrorCategory.USER_ERROR:
        return this.getUserErrorMessage(error);
      case ErrorCategory.SYSTEM_ERROR:
        return this.getSystemErrorMessage(error);
      case ErrorCategory.NETWORK_ERROR:
        return this.getNetworkErrorMessage(error);
      case ErrorCategory.SECURITY_ERROR:
        return this.getSecurityErrorMessage(error);
      case ErrorCategory.CONFIGURATION_ERROR:
        return this.getConfigurationErrorMessage(error);
      default:
        return `An error occurred: ${error.message}`;
    }
  }

  /**
   * Get recovery suggestions for an error
   */
  public getRecoverySuggestions(error: FilesystemError): string[] {
    const suggestions: string[] = [];

    switch (error.category) {
      case ErrorCategory.USER_ERROR:
        if (
          error.message.includes("not found") ||
          error.message.includes("ENOENT")
        ) {
          suggestions.push("Check that the file or directory exists");
          suggestions.push("Verify the path is correct");
        }
        if (
          error.message.includes("permission denied") ||
          error.message.includes("access denied") ||
          error.message.includes("EACCES")
        ) {
          suggestions.push("Check file permissions");
          suggestions.push("Try running VS Code with appropriate permissions");
        }
        break;

      case ErrorCategory.SYSTEM_ERROR:
        suggestions.push("Check system resources (disk space, memory)");
        suggestions.push("Try restarting VS Code");
        suggestions.push("Check the output log for details");
        break;

      case ErrorCategory.NETWORK_ERROR:
        suggestions.push("Check that the MCP server is running");
        suggestions.push("Verify network connectivity");
        suggestions.push("Try restarting the MCP server");
        break;

      case ErrorCategory.SECURITY_ERROR:
        suggestions.push("Review security settings in extension configuration");
        suggestions.push("Check blocked paths and patterns");
        if (error.context?.path) {
          suggestions.push(
            `The path "${error.context.path}" may be blocked by security settings`
          );
        }
        break;

      case ErrorCategory.CONFIGURATION_ERROR:
        suggestions.push("Review extension settings");
        suggestions.push("Reset to default configuration");
        suggestions.push("Check for invalid setting values");
        break;
    }

    return suggestions;
  }

  /**
   * Log error details
   */
  private logError(error: FilesystemError): void {
    const timestamp = new Date().toISOString();
    const category = error.category || "unknown";

    this.outputChannel.error(
      `[${timestamp}] [${category.toUpperCase()}] ${error.message}`
    );

    if (error.context) {
      this.outputChannel.error(`Context: ${JSON.stringify(error.context)}`);
    }

    if (error.stack) {
      this.outputChannel.error(`Stack trace:\n${error.stack}`);
    }

    if (error.originalError) {
      this.outputChannel.error(
        `Original error: ${error.originalError.message}`
      );
      if (error.originalError.stack) {
        this.outputChannel.error(
          `Original stack:\n${error.originalError.stack}`
        );
      }
    }
  }

  /**
   * Get error key for aggregation
   */
  private getErrorKey(error: FilesystemError): string {
    return `${error.category}:${error.message}`;
  }

  /**
   * Aggregate similar errors
   * Returns true if error was aggregated, false if it should be shown
   */
  private aggregateError(key: string, error: FilesystemError): boolean {
    const now = new Date();
    const existing = this.errorAggregation.get(key);

    if (existing) {
      const timeSinceFirst = now.getTime() - existing.firstOccurrence.getTime();

      if (timeSinceFirst < this.aggregationWindow) {
        // Within aggregation window, increment count
        existing.count++;
        existing.lastOccurrence = now;
        return true; // Aggregated, don't show
      } else {
        // Outside window, show aggregated message and reset
        if (existing.count > 1) {
          this.showAggregatedError(existing);
        }
        this.errorAggregation.delete(key);
      }
    }

    // Start new aggregation entry
    this.errorAggregation.set(key, {
      error,
      count: 1,
      firstOccurrence: now,
      lastOccurrence: now,
    });

    return false; // Not aggregated, should show
  }

  /**
   * Show aggregated error message
   */
  private showAggregatedError(entry: ErrorAggregationEntry): void {
    const message = `${this.getUserFriendlyMessage(entry.error)} (occurred ${
      entry.count
    } times)`;
    this.showError(entry.error.category, message);
  }

  /**
   * Show error message to user
   */
  private showError(category: ErrorCategory, message: string): void {
    switch (category) {
      case ErrorCategory.USER_ERROR:
      case ErrorCategory.CONFIGURATION_ERROR:
        vscode.window.showWarningMessage(`Filesystem: ${message}`);
        break;
      case ErrorCategory.SECURITY_ERROR:
        vscode.window.showErrorMessage(`Filesystem Security: ${message}`);
        break;
      default:
        vscode.window.showErrorMessage(`Filesystem: ${message}`);
    }
  }

  /**
   * Show error with recovery suggestions
   */
  private showErrorWithSuggestions(
    message: string,
    suggestions: string[]
  ): void {
    const items = suggestions.map((s) => ({ title: s }));
    vscode.window.showErrorMessage(`Filesystem: ${message}`, ...items);
  }

  /**
   * Get user error message
   */
  private getUserErrorMessage(error: FilesystemError): string {
    const message = error.message;

    if (message.includes("ENOENT") || message.includes("not found")) {
      return "The file or directory could not be found";
    }
    if (message.includes("EACCES") || message.includes("permission denied")) {
      return "Permission denied - you don't have access to this file or directory";
    }
    if (message.includes("EISDIR")) {
      return "Expected a file but found a directory";
    }
    if (message.includes("ENOTDIR")) {
      return "Expected a directory but found a file";
    }
    if (message.includes("EEXIST")) {
      return "The file or directory already exists";
    }

    return `Invalid operation: ${message}`;
  }

  /**
   * Get system error message
   */
  private getSystemErrorMessage(error: FilesystemError): string {
    const message = error.message;

    if (message.includes("ENOSPC")) {
      return "No space left on device";
    }
    if (message.includes("EMFILE")) {
      return "Too many open files";
    }
    if (message.includes("ENOMEM")) {
      return "Out of memory";
    }

    return `System error: ${message}`;
  }

  /**
   * Get network error message
   */
  private getNetworkErrorMessage(error: FilesystemError): string {
    const message = error.message;

    if (message.includes("ECONNREFUSED")) {
      return "Could not connect to MCP server - connection refused";
    }
    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return "Connection to MCP server timed out";
    }
    if (message.includes("ENOTFOUND")) {
      return "MCP server not found";
    }

    return `Network error: ${message}`;
  }

  /**
   * Get security error message
   */
  private getSecurityErrorMessage(error: FilesystemError): string {
    if (error.context?.path && error.context?.boundary) {
      return `Access denied: "${error.context.path}" is outside the allowed boundary "${error.context.boundary}"`;
    }

    if (error.context?.path && error.context?.pattern) {
      return `Access denied: "${error.context.path}" matches blocked pattern "${error.context.pattern}"`;
    }

    if (error.context?.path) {
      return `Access denied: "${error.context.path}" is blocked by security settings`;
    }

    return `Security violation: ${error.message}`;
  }

  /**
   * Get configuration error message
   */
  private getConfigurationErrorMessage(error: FilesystemError): string {
    return `Configuration error: ${error.message}`;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.errorAggregation.clear();
  }
}

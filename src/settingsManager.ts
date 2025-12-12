import * as vscode from "vscode";

/**
 * Server settings interface
 */
export interface ServerSettings {
  serverPath: string;
  autoStart: boolean;
  timeout: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Security settings interface
 */
export interface SecuritySettings {
  workspaceRoot: string;
  allowedSubdirectories: string[];
  blockedPaths: string[];
  blockedPatterns: string[];
  maxFileSize: number;
  maxBatchSize: number;
  maxOperationsPerMinute: number;
}

/**
 * Operations settings interface
 */
export interface OperationsSettings {
  enableBatch: boolean;
  enableWatch: boolean;
  enableSearch: boolean;
  enableChecksum: boolean;
}

/**
 * UI settings interface
 */
export interface UISettings {
  refreshInterval: number;
  showNotifications: boolean;
  showSecurityWarnings: boolean;
  confirmDangerousOperations: boolean;
}

/**
 * Complete filesystem settings interface
 */
export interface FilesystemSettings {
  server: ServerSettings;
  security: SecuritySettings;
  operations: OperationsSettings;
  ui: UISettings;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Settings Manager class
 * Provides centralized, type-safe configuration management
 */
export class SettingsManager {
  private settings: FilesystemSettings;
  private readonly changeEmitter: vscode.EventEmitter<FilesystemSettings>;
  private readonly configSection = "mcp-filesystem";

  /**
   * Event fired when settings change
   */
  public readonly onDidChange: vscode.Event<FilesystemSettings>;

  constructor() {
    this.changeEmitter = new vscode.EventEmitter<FilesystemSettings>();
    this.onDidChange = this.changeEmitter.event;
    this.settings = this.loadSettings();
  }

  /**
   * Get current settings
   */
  public getSettings(): FilesystemSettings {
    return { ...this.settings };
  }

  /**
   * Load settings from VS Code configuration
   */
  private loadSettings(): FilesystemSettings {
    const config = vscode.workspace.getConfiguration(this.configSection);

    // Load server settings
    const server: ServerSettings = {
      serverPath: config.get<string>("server.serverPath", ""),
      autoStart: config.get<boolean>("server.autoStart", true),
      timeout: config.get<number>("server.timeout", 30000),
      logLevel: config.get<"debug" | "info" | "warn" | "error">(
        "server.logLevel",
        "info"
      ),
    };

    // Load security settings
    const security: SecuritySettings = {
      workspaceRoot: config.get<string>(
        "security.workspaceRoot",
        "${workspaceFolder}"
      ),
      allowedSubdirectories: config.get<string[]>(
        "security.allowedSubdirectories",
        []
      ),
      blockedPaths: config.get<string[]>("security.blockedPaths", [
        ".git",
        ".env",
        "node_modules",
        ".ssh",
      ]),
      blockedPatterns: config.get<string[]>("security.blockedPatterns", [
        "*.key",
        "*.pem",
        "*.env",
        "*secret*",
        "*password*",
      ]),
      maxFileSize: config.get<number>("resources.maxFileSize", 104857600), // 100 MB
      maxBatchSize: config.get<number>("resources.maxBatchSize", 1073741824), // 1 GB
      maxOperationsPerMinute: config.get<number>(
        "resources.maxOperationsPerMinute",
        100
      ),
    };

    // Load operations settings
    const operations: OperationsSettings = {
      enableBatch: config.get<boolean>("operations.enableBatch", true),
      enableWatch: config.get<boolean>("operations.enableWatch", true),
      enableSearch: config.get<boolean>("operations.enableSearch", true),
      enableChecksum: config.get<boolean>("operations.enableChecksum", true),
    };

    // Load UI settings
    const ui: UISettings = {
      refreshInterval: config.get<number>("ui.refreshInterval", 5000),
      showNotifications: config.get<boolean>("ui.showNotifications", true),
      showSecurityWarnings: config.get<boolean>(
        "ui.showSecurityWarnings",
        true
      ),
      confirmDangerousOperations: config.get<boolean>(
        "ui.confirmDangerousOperations",
        true
      ),
    };

    return { server, security, operations, ui };
  }

  /**
   * Validate settings
   */
  public validateSettings(settings: FilesystemSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate server settings
    if (settings.server.timeout < 1000) {
      errors.push("Server timeout must be at least 1000ms");
    }
    if (settings.server.timeout > 300000) {
      warnings.push("Server timeout is very high (>5 minutes)");
    }

    // Validate security settings
    if (settings.security.maxFileSize < 1024) {
      errors.push("Max file size must be at least 1024 bytes");
    }
    if (settings.security.maxFileSize > 10737418240) {
      // 10 GB
      warnings.push("Max file size is very large (>10 GB)");
    }

    if (settings.security.maxBatchSize < settings.security.maxFileSize) {
      errors.push("Max batch size must be at least as large as max file size");
    }

    if (settings.security.maxOperationsPerMinute < 1) {
      errors.push("Max operations per minute must be at least 1");
    }
    if (settings.security.maxOperationsPerMinute > 1000) {
      warnings.push("Max operations per minute is very high (>1000)");
    }

    // Validate blocked paths
    if (settings.security.blockedPaths.length === 0) {
      warnings.push(
        "No blocked paths configured - consider blocking sensitive directories"
      );
    }

    // Validate blocked patterns
    if (settings.security.blockedPatterns.length === 0) {
      warnings.push(
        "No blocked patterns configured - consider blocking sensitive file patterns"
      );
    }

    // Validate UI settings
    if (settings.ui.refreshInterval < 0) {
      errors.push("Refresh interval cannot be negative");
    }
    if (settings.ui.refreshInterval > 0 && settings.ui.refreshInterval < 1000) {
      warnings.push(
        "Refresh interval is very low (<1 second) - may impact performance"
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Update settings
   */
  public async updateSettings(
    updates: Partial<FilesystemSettings>
  ): Promise<void> {
    const newSettings: FilesystemSettings = {
      server: { ...this.settings.server, ...updates.server },
      security: { ...this.settings.security, ...updates.security },
      operations: { ...this.settings.operations, ...updates.operations },
      ui: { ...this.settings.ui, ...updates.ui },
    };

    // Validate new settings
    const validation = this.validateSettings(newSettings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.errors.join(", ")}`);
    }

    // Update VS Code configuration
    const config = vscode.workspace.getConfiguration(this.configSection);

    if (updates.server) {
      for (const [key, value] of Object.entries(updates.server)) {
        await config.update(
          `server.${key}`,
          value,
          vscode.ConfigurationTarget.Workspace
        );
      }
    }

    if (updates.security) {
      for (const [key, value] of Object.entries(updates.security)) {
        const configKey =
          key === "maxFileSize" ||
          key === "maxBatchSize" ||
          key === "maxOperationsPerMinute"
            ? `resources.${key}`
            : `security.${key}`;
        await config.update(
          configKey,
          value,
          vscode.ConfigurationTarget.Workspace
        );
      }
    }

    if (updates.operations) {
      for (const [key, value] of Object.entries(updates.operations)) {
        await config.update(
          `operations.${key}`,
          value,
          vscode.ConfigurationTarget.Workspace
        );
      }
    }

    if (updates.ui) {
      for (const [key, value] of Object.entries(updates.ui)) {
        await config.update(
          `ui.${key}`,
          value,
          vscode.ConfigurationTarget.Workspace
        );
      }
    }

    // Update internal state
    this.settings = newSettings;

    // Emit change event
    this.changeEmitter.fire(this.settings);
  }

  /**
   * Reload settings from configuration
   */
  public reloadSettings(): void {
    this.settings = this.loadSettings();
    this.changeEmitter.fire(this.settings);
  }

  /**
   * Reload settings from configuration (alias for reloadSettings)
   */
  public reload(): void {
    this.reloadSettings();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.changeEmitter.dispose();
  }
}

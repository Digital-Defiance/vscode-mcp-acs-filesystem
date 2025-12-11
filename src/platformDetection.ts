import * as os from "os";
import * as path from "path";

/**
 * Platform type enum
 */
export enum PlatformType {
  WINDOWS = "windows",
  MACOS = "macos",
  LINUX = "linux",
  UNKNOWN = "unknown",
}

/**
 * Platform information interface
 */
export interface PlatformInfo {
  type: PlatformType;
  pathSeparator: string;
  homeDirectory: string;
  tempDirectory: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
}

/**
 * Platform Detection class
 * Handles platform-specific logic for filesystem operations
 */
export class PlatformDetection {
  private static platformInfo: PlatformInfo | null = null;

  /**
   * Get platform information
   * Detects and caches platform details
   */
  public static getPlatformInfo(): PlatformInfo {
    if (!this.platformInfo) {
      this.platformInfo = this.detectPlatform();
    }
    return this.platformInfo;
  }

  /**
   * Detect current platform
   */
  private static detectPlatform(): PlatformInfo {
    const platform = os.platform();
    let type: PlatformType;

    switch (platform) {
      case "win32":
        type = PlatformType.WINDOWS;
        break;
      case "darwin":
        type = PlatformType.MACOS;
        break;
      case "linux":
        type = PlatformType.LINUX;
        break;
      default:
        type = PlatformType.UNKNOWN;
    }

    return {
      type,
      pathSeparator: path.sep,
      homeDirectory: os.homedir(),
      tempDirectory: os.tmpdir(),
      isWindows: type === PlatformType.WINDOWS,
      isMacOS: type === PlatformType.MACOS,
      isLinux: type === PlatformType.LINUX,
    };
  }

  /**
   * Normalize a path for the current platform
   * Converts path separators and resolves relative paths
   */
  public static normalizePath(inputPath: string): string {
    // Replace all backslashes and forward slashes with platform separator
    const normalized = inputPath.replace(/[/\\]+/g, path.sep);

    // Resolve to absolute path if relative
    return path.normalize(normalized);
  }

  /**
   * Join path segments using platform-appropriate separator
   */
  public static joinPaths(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Convert a path to use forward slashes (for display/comparison)
   */
  public static toForwardSlashes(inputPath: string): string {
    return inputPath.replace(/\\/g, "/");
  }

  /**
   * Convert a path to use backslashes (Windows-specific)
   */
  public static toBackslashes(inputPath: string): string {
    return inputPath.replace(/\//g, "\\");
  }

  /**
   * Get platform-specific command syntax
   * Returns the appropriate shell command for the platform
   */
  public static getCommandSyntax(command: string): string {
    const info = this.getPlatformInfo();

    if (info.isWindows) {
      // Windows uses cmd.exe or PowerShell
      // Wrap in quotes if contains spaces
      return command.includes(" ") ? `"${command}"` : command;
    } else {
      // Unix-like systems (macOS, Linux)
      // Escape spaces with backslash
      return command.replace(/ /g, "\\ ");
    }
  }

  /**
   * Get platform-specific shell
   */
  public static getShell(): string {
    const info = this.getPlatformInfo();

    if (info.isWindows) {
      return process.env.COMSPEC || "cmd.exe";
    } else {
      return process.env.SHELL || "/bin/sh";
    }
  }

  /**
   * Get platform-specific blocked paths
   * Returns paths that should be blocked for security on this platform
   */
  public static getPlatformBlockedPaths(): string[] {
    const info = this.getPlatformInfo();
    const blockedPaths: string[] = [
      // Common across all platforms
      ".git",
      ".env",
      "node_modules",
    ];

    if (info.isWindows) {
      blockedPaths.push(
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\ProgramData",
        "C:\\Users\\*\\AppData"
      );
    } else if (info.isMacOS) {
      blockedPaths.push(
        "/System",
        "/Library",
        "/private",
        "/usr",
        "/bin",
        "/sbin",
        "/etc",
        "~/.ssh",
        "~/Library/Keychains"
      );
    } else if (info.isLinux) {
      blockedPaths.push(
        "/sys",
        "/proc",
        "/dev",
        "/boot",
        "/usr",
        "/bin",
        "/sbin",
        "/etc",
        "~/.ssh",
        "~/.gnupg"
      );
    }

    return blockedPaths;
  }

  /**
   * Validate a path against platform-specific security boundaries
   * Returns true if the path is allowed, false if blocked
   */
  public static validatePathSecurity(inputPath: string): {
    allowed: boolean;
    reason?: string;
  } {
    const normalizedPath = this.normalizePath(inputPath);
    const blockedPaths = this.getPlatformBlockedPaths();
    const info = this.getPlatformInfo();

    // Expand home directory if present
    const expandedPath = normalizedPath.replace(/^~/, info.homeDirectory);

    // Check against blocked paths
    for (const blockedPath of blockedPaths) {
      const expandedBlockedPath = blockedPath.replace(/^~/, info.homeDirectory);

      // Handle wildcard patterns
      if (expandedBlockedPath.includes("*")) {
        const pattern = expandedBlockedPath.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}`);
        if (regex.test(expandedPath)) {
          return {
            allowed: false,
            reason: `Path matches blocked pattern: ${blockedPath}`,
          };
        }
      } else {
        // Exact or prefix match
        if (
          expandedPath === expandedBlockedPath ||
          expandedPath.startsWith(expandedBlockedPath + path.sep)
        ) {
          return {
            allowed: false,
            reason: `Path is within blocked directory: ${blockedPath}`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Format a path for display to the user
   * Uses platform conventions for readability
   */
  public static formatPathForDisplay(inputPath: string): string {
    const info = this.getPlatformInfo();
    const normalized = this.normalizePath(inputPath);

    // Replace home directory with ~
    if (normalized.startsWith(info.homeDirectory)) {
      return normalized.replace(info.homeDirectory, "~");
    }

    // On Windows, ensure drive letter is uppercase
    if (info.isWindows && /^[a-z]:/.test(normalized)) {
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    return normalized;
  }

  /**
   * Check if a path is absolute
   */
  public static isAbsolutePath(inputPath: string): boolean {
    return path.isAbsolute(inputPath);
  }

  /**
   * Get the directory name from a path
   */
  public static getDirname(inputPath: string): string {
    return path.dirname(inputPath);
  }

  /**
   * Get the base name from a path
   */
  public static getBasename(inputPath: string): string {
    return path.basename(inputPath);
  }

  /**
   * Get the file extension from a path
   */
  public static getExtension(inputPath: string): string {
    return path.extname(inputPath);
  }

  /**
   * Resolve a relative path against a base path
   */
  public static resolvePath(basePath: string, relativePath: string): string {
    return path.resolve(basePath, relativePath);
  }
}

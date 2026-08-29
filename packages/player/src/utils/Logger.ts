/**
 * Logger - Configurable logging utility
 */

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

let currentLevel: LogLevel = LogLevel.SILENT;

export const Logger = {
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  getLevel(): LogLevel {
    return currentLevel;
  },

  error(tag: string, message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.ERROR) {
      console.error(`[movi:${tag}]`, message, ...args);
    }
  },

  warn(tag: string, message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(`[movi:${tag}]`, message, ...args);
    }
  },

  info(tag: string, message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.INFO) {
      console.info(`[movi:${tag}]`, message, ...args);
    }
  },

  debug(tag: string, message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.DEBUG) {
      console.debug(`[movi:${tag}]`, message, ...args);
    }
  },

  trace(tag: string, message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.TRACE) {
      console.trace(`[movi:${tag}]`, message, ...args);
    }
  },
};

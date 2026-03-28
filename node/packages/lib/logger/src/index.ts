/* eslint-disable no-console */

export type LogContext = Record<string, unknown>;

export type Logger = {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: unknown, context?: LogContext) => void;
};

export function createLogger(prefix?: string): Logger {
  const fmt = (msg: string): string => (prefix !== undefined ? `[${prefix}] ${msg}` : msg);

  return {
    debug: (message, context): void => console.debug(fmt(message), context ?? ""),
    info: (message, context): void => console.info(fmt(message), context ?? ""),
    warn: (message, context): void => console.warn(fmt(message), context ?? ""),
    error: (message, error, context): void =>
      console.error(fmt(message), error ?? "", context ?? ""),
  };
}

export function createSilentLogger(): Logger {
  return {
    debug: (): void => {
      // noop
    },
    info: (): void => {
      // noop
    },
    warn: (): void => {
      // noop
    },
    error: (): void => {
      // noop
    },
  };
}

export const logger = createLogger();

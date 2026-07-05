import type { Context } from 'aws-lambda';
import { LOG_LEVEL, STAGE } from './env.js';

/** Supported log levels in ascending severity order. */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

/** Minimum level to emit. Controlled by LOG_LEVEL env var (see src/shared/core/env.ts). */
const MIN_LEVEL: LogLevel = (LOG_LEVEL as LogLevel | undefined) ?? 'INFO';

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

/** Serializes an unknown caught value into a plain object for JSON output. */
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack?.split('\n').map((line) => line.trim()) ?? [],
    };
  }
  return { rawError: String(err) };
}

/** Structured log entry written to stdout/stderr as a single JSON line. */
interface LogEntry {
  readonly level: LogLevel;
  readonly timestamp: string;
  readonly message: string;
  readonly fn: string;
  readonly stage: string;
  readonly requestId: string;
  readonly remainingMs?: number;
  readonly memoryMb?: number;
  readonly [key: string]: unknown;
}

function buildEntry(
  level: LogLevel,
  message: string,
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
  ctx: Context | undefined,
): LogEntry {
  return {
    level,
    timestamp: new Date().toISOString(),
    message,
    fn: String(base['fn'] ?? 'unknown'),
    stage: STAGE,
    requestId: String(base['requestId'] ?? ctx?.awsRequestId ?? 'local'),
    ...(ctx !== undefined && {
      remainingMs: ctx.getRemainingTimeInMillis(),
      memoryMb: Number(ctx.memoryLimitInMB),
    }),
    ...base,
    ...extra,
  };
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'ERROR' || entry.level === 'WARN') {
    console.error(line);
  } else {
    console.log(line);
  }
}

/** Logger interface exposed to handlers and shared modules. */
export interface Logger {
  /** Low-level diagnostic detail. Only emitted when LOG_LEVEL=DEBUG. */
  readonly debug: (message: string, extra?: Record<string, unknown>) => void;
  /** Normal operational events (request start, result, important decisions). */
  readonly info: (message: string, extra?: Record<string, unknown>) => void;
  /** Unexpected situations that don't stop execution (fallback used, retry, upsert). */
  readonly warn: (message: string, extra?: Record<string, unknown>) => void;
  /** Failures and exceptions. Includes full error serialization. */
  readonly error: (message: string, err?: unknown, extra?: Record<string, unknown>) => void;
  /**
   * Returns a function that logs an INFO entry with `durationMs` set to the
   * elapsed time since `timer()` was called. Useful for tracking operation latency.
   *
   * @example
   * const stop = log.timer();
   * await doWork();
   * stop('Gemini call completed', { model: 'gemini-1.5-flash' });
   */
  readonly timer: () => (label: string, extra?: Record<string, unknown>) => void;
  /**
   * Creates a child logger that merges `extra` into every log entry.
   * Use to scope logs to a specific request, user, or operation.
   *
   * @example
   * const reqLog = log.child({ userId, postId });
   * reqLog.info('Processing'); // includes userId and postId automatically
   */
  readonly child: (extra: Record<string, unknown>) => Logger;
}

/**
 * Creates a structured JSON logger scoped to a Lambda function invocation.
 *
 * Every entry is written as a single JSON line to stdout (INFO/DEBUG) or
 * stderr (WARN/ERROR). CloudWatch Logs Insights can query these entries
 * using `fields @timestamp, level, message, fn, requestId, userId`.
 *
 * @param functionName - The Lambda function name (shown as `fn` in every entry).
 * @param ctx          - The Lambda `Context` object. Provides `requestId`,
 *                       `remainingMs`, and `memoryMb` in every entry.
 */
export function createLogger(functionName: string, ctx?: Context): Logger {
  const base: Record<string, unknown> = {
    fn: functionName,
    ...(ctx !== undefined && { requestId: ctx.awsRequestId }),
  };

  function write(
    level: LogLevel,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    if (!shouldEmit(level)) return;
    emit(buildEntry(level, message, base, extra, ctx));
  }

  return makeLogger(base, ctx, write);
}

function makeLogger(
  base: Record<string, unknown>,
  ctx: Context | undefined,
  write: (level: LogLevel, msg: string, extra?: Record<string, unknown>) => void,
): Logger {
  return {
    debug: (message, extra) => write('DEBUG', message, extra),
    info:  (message, extra) => write('INFO',  message, extra),
    warn:  (message, extra) => write('WARN',  message, extra),
    error: (message, err, extra) =>
      write('ERROR', message, {
        ...extra,
        ...(err !== undefined ? serializeError(err) : {}),
      }),
    timer: () => {
      const start = Date.now();
      return (label, extra) =>
        write('INFO', label, { ...extra, durationMs: Date.now() - start });
    },
    child: (extra) => {
      const childBase = { ...base, ...extra };
      function childWrite(
        level: LogLevel,
        message: string,
        childExtra: Record<string, unknown> = {},
      ): void {
        if (!shouldEmit(level)) return;
        emit(buildEntry(level, message, childBase, childExtra, ctx));
      }
      return makeLogger(childBase, ctx, childWrite);
    },
  };
}

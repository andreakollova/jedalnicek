type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === 'password' || key === 'token' || key === 'secret' || key === 'cookie') continue;
      entry[key] = value;
    }
  }
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) console.log(formatLog('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) console.log(formatLog('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) console.error(formatLog('error', message, meta));
  },
};

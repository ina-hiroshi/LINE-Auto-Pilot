type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const MIN_LEVEL: LogLevel = (Deno.env.get('LOG_LEVEL') as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatMessage(prefix: string, level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString()
  const base = `[${ts}] [${level.toUpperCase()}] [${prefix}] ${message}`
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`
  }
  return base
}

export function createLogger(prefix: string) {
  return {
    debug(message: string, data?: unknown) {
      if (shouldLog('debug')) console.debug(formatMessage(prefix, 'debug', message, data))
    },
    info(message: string, data?: unknown) {
      if (shouldLog('info')) console.log(formatMessage(prefix, 'info', message, data))
    },
    warn(message: string, data?: unknown) {
      if (shouldLog('warn')) console.warn(formatMessage(prefix, 'warn', message, data))
    },
    error(message: string, data?: unknown) {
      if (shouldLog('error')) console.error(formatMessage(prefix, 'error', message, data))
    },
  }
}

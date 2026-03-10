type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function write(level: LogLevel, message: string, ...args: unknown[]) {
  const prefix = `[src] ${level}`;
  console.log(`${prefix} ${message}`, ...args);
}

export const log = {
  info(message: string, ...args: unknown[]) {
    write('INFO', message, ...args);
  },

  warn(message: string, ...args: unknown[]) {
    write('WARN', message, ...args);
  },

  error(message: string, ...args: unknown[]) {
    write('ERROR', message, ...args);
  },
};

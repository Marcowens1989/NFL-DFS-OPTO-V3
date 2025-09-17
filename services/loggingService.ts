// services/loggingService.ts
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogPayload {
  [key: string]: any;
}

const log = (level: LogLevel, message: string, payload?: LogPayload) => {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...payload,
  };
  
  const output = JSON.stringify(logObject);

  switch (level) {
    case 'INFO':
      console.log(output);
      break;
    case 'WARN':
      console.warn(output);
      break;
    case 'ERROR':
      console.error(output);
      break;
  }
};

export const logger = {
  info: (message: string, payload?: LogPayload) => log('INFO', message, payload),
  warn: (message: string, payload?: LogPayload) => log('WARN', message, payload),
  error: (message: string, payload?: LogPayload) => log('ERROR', message, payload),
};

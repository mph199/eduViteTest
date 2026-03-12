import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}  // JSON output in production (default)
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }
  ),
});

export default logger;

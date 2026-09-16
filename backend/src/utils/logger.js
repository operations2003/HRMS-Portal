/**
 * Structured Logger for Integration Monitoring & Audit Logging
 */

const formatTimestamp = () => new Date().toISOString();

const formatMessage = (level, context, message, meta = {}) => {
  const metaString = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
  return `[${formatTimestamp()}] [${level}] [${context}] ${message}${metaString}`;
};

export const logger = {
  info(context, message, meta = {}) {
    console.log(formatMessage('INFO', context, message, meta));
  },

  warn(context, message, meta = {}) {
    console.warn(formatMessage('WARN', context, message, meta));
  },

  error(context, message, error = null, meta = {}) {
    const errorDetails = error
      ? {
          errorMessage: error.message,
          stack: error.stack ? error.stack.split('\n').slice(0, 3).map((s) => s.trim()) : undefined,
          statusCode: error.statusCode || error.status || 500,
          ...meta,
        }
      : meta;

    console.error(formatMessage('ERROR', context, message, errorDetails));
  },
};

export default logger;

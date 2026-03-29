import winston from "winston";
import * as dotenv from "dotenv";

dotenv.config();

const environment = process.env.NODE_ENV ?? "development";

// ── Custom log format for development (colorized, readable)
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? "\n  " + JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")
      : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ── Custom log format for production (JSON structured)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Create logger
export const logger = winston.createLogger({
  level: environment === "production" ? "info" : "debug",
  format: environment === "production" ? prodFormat : devFormat,
  defaultMeta: {
    service: "fintech-api",
    environment,
    version: "1.0.0",
  },
  transports: [
    // Console transport — always on
    new winston.transports.Console(),

    // File transport — errors only
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),

    // File transport — all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

// ── Convenience methods with structured context
export const logRequest = (
  method: string,
  path: string,
  status: number,
  durationMs: number,
  traceId?: string,
  userId?: string
) => {
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  logger.log(level, `${method} ${path} ${status}`, {
    type: "request",
    method,
    path,
    status,
    durationMs,
    traceId,
    userId,
  });
};

export const logPayment = (
  event: string,
  transactionId: string,
  amount: number,
  currency: string,
  status: string,
  meta?: Record<string, unknown>
) => {
  logger.info(`Payment ${event}`, {
    type: "payment",
    event,
    transactionId,
    amount,
    currency,
    status,
    ...meta,
  });
};

export const logError = (
  message: string,
  error: Error,
  context?: Record<string, unknown>
) => {
  logger.error(message, {
    type: "error",
    errorMessage: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logDB = (
  operation: string,
  table: string,
  durationMs: number,
  success: boolean
) => {
  logger.debug(`DB ${operation} on ${table}`, {
    type: "database",
    operation,
    table,
    durationMs,
    success,
  });
};
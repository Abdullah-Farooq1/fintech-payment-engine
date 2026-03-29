import { Context, Next } from "hono";
import { logRequest } from "../lib/logger";

export const winstonLogger = async (c: Context, next: Next) => {
  const start = Date.now();
  const traceId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Attach trace ID
  (c as any).set("traceId", traceId);
  c.header("X-Trace-ID", traceId);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Get user ID if available
  const userId = (c as any).get("userID") as string | undefined;

  logRequest(
    c.req.method,
    c.req.path,
    status,
    duration,
    traceId,
    userId
  );
};
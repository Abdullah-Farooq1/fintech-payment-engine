import { Context, Next } from "hono";

export const requestLogger = async (c: Context, next: Next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const traceId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Attach trace ID to request context
  (c as any).set("traceId", traceId);

  console.log(`→ [${traceId}] ${method} ${path}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(
    `← [${traceId}] ${method} ${path} ${status} ${duration}ms`
  );
};
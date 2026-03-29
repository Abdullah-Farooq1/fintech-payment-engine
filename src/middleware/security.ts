import { Context, Next } from "hono";
import { logger } from "../lib/logger";

// ── Security headers middleware
export const securityHeaders = async (c: Context, next: Next) => {
  // Prevent clickjacking
  c.header("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // XSS protection
  c.header("X-XSS-Protection", "1; mode=block");

  // Strict transport security
  c.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Content security policy
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );

  // Remove server header
  c.header("X-Powered-By", "");
  c.header("Server", "");

  // Referrer policy
  c.header("Referrer-Policy", "no-referrer");

  // Permissions policy
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  await next();
};

// ── Request size limiter
export const requestSizeLimiter = (maxSizeKB: number = 100) => {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header("content-length");

    if (contentLength) {
      const sizeKB = parseInt(contentLength) / 1024;
      if (sizeKB > maxSizeKB) {
        logger.warn("Request too large", {
          type: "security",
          sizeKB: sizeKB.toFixed(2),
          maxSizeKB,
          path: c.req.path,
        });

        return c.json(
          {
            success: false,
            error: `Request too large. Maximum size: ${maxSizeKB}KB`,
            code: "REQUEST_TOO_LARGE",
          },
          413
        );
      }
    }

    await next();
  };
};

// ── SQL injection pattern detector
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
  /(--|;|\/\*|\*\/)/g,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
  /('|(\\')|(--)|(%27)|(%23)|(#))/g,
];

export const sqlInjectionDetector = async (c: Context, next: Next) => {
  if (c.req.method === "POST" || c.req.method === "PUT") {
    try {
      const body = await c.req.text();

      const isSuspicious = SQL_INJECTION_PATTERNS.some((pattern) =>
        pattern.test(body)
      );

      if (isSuspicious) {
        logger.warn("Potential SQL injection detected", {
          type: "security",
          path: c.req.path,
          method: c.req.method,
          ip: c.req.header("x-forwarded-for") ?? "unknown",
        });

        return c.json(
          {
            success: false,
            error: "Invalid request content",
            code: "INVALID_CONTENT",
          },
          400
        );
      }
    } catch {
      // If we can't read body — let it pass to normal handler
    }
  }

  await next();
};

// ── IP allowlist for admin routes
export const ipAllowlist = (allowedIPs: string[]) => {
  return async (c: Context, next: Next) => {
    const clientIP =
      c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ??
      "127.0.0.1";

    const isAllowed =
      allowedIPs.includes(clientIP) ||
      allowedIPs.includes("*") ||
      clientIP.startsWith("127.") ||
      clientIP.startsWith("::1");

    if (!isAllowed) {
      logger.warn("IP not in allowlist", {
        type: "security",
        clientIP,
        path: c.req.path,
      });

      return c.json(
        {
          success: false,
          error: "Access denied",
          code: "IP_BLOCKED",
        },
        403
      );
    }

    await next();
  };
};

// ── Audit logger for sensitive operations
export const auditLog = (operation: string) => {
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get("traceId") ?? "unknown";
    const userId = (c as any).get("userID") ?? "anonymous";

    logger.info(`Audit: ${operation}`, {
      type: "audit",
      operation,
      traceId,
      userId,
      path: c.req.path,
      method: c.req.method,
      ip:
        c.req.header("x-forwarded-for") ??
        c.req.header("x-real-ip") ??
        "unknown",
      timestamp: new Date().toISOString(),
    });

    await next();
  };
};
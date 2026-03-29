import { Context, Next } from "hono";
import { logError } from "../lib/logger";

const KNOWN_ERRORS = [
  "not found",
  "Insufficient funds",
  "Currency mismatch",
  "already exists",
  "Invalid",
];

export const isKnownError = (message: string): boolean => {
  return KNOWN_ERRORS.some((e) =>
    message.toLowerCase().includes(e.toLowerCase())
  );
};

export const formatError = (
  error: any,
  traceId?: string
): {
  success: false;
  error: string;
  traceId?: string;
  code: string;
} => {
  const message = error?.message ?? "An unexpected error occurred";
  const known = isKnownError(message);

  if (!known) {
    logError("Unhandled server error", error as Error, { traceId });
  }

  return {
    success: false,
    error: message,
    traceId,
    code: known ? "BUSINESS_ERROR" : "INTERNAL_ERROR",
  };
};

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error: any) {
    const traceId = (c as any).get("traceId");
    const formatted = formatError(error, traceId);

    if (isKnownError(error?.message ?? "")) {
      return c.json(formatted, 422);
    }

    return c.json(formatted, 500);
  }
};
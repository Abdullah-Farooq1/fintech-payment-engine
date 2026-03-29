import { Context, Next } from "hono";

export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return async (c: Context, next: Next) => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Request timeout after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    );

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error: any) {
      if (error.message?.includes("timeout")) {
        return c.json(
          {
            success: false,
            error: "Request timed out",
            code: "TIMEOUT",
          },
          408
        );
      }
      throw error;
    }
  };
};
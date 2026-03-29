import { Context, Next } from "hono";
import { ZodSchema } from "zod";

export const validateBody = (schema: ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: "Validation failed",
            details: result.error.issues.map((e: any) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          400
        );
      }

      // Store validated data in context
      (c as any).set("validatedBody", result.data);

      return next();
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400
      );
    }
  };
};
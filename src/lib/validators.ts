import { z } from "zod";

export const createPaymentIntentSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive"),

  currency: z.enum(["USD", "EUR", "GBP", "PKR"]).optional().default("USD"),

  sourceAccountId: z
    .string()
    .uuid("Source account ID must be a valid UUID"),

  destinationAccountId: z
    .string()
    .uuid("Destination account ID must be a valid UUID"),

  description: z
    .string()
    .min(3, "Description must be at least 3 characters")
    .max(500, "Description too long")
    .optional(),

  metadata: z.record(z.string(), z.unknown()).optional().default({}),

  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key too long"),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
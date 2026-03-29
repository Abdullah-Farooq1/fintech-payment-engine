import { Context, Next } from "hono";
import { db } from "../db";
import { transactions } from "../schema";
import { eq } from "drizzle-orm";

export const idempotencyMiddleware = async (c: Context, next: Next) => {
  // Only apply to POST requests
  if (c.req.method !== "POST") {
    return next();
  }

  const idempotencyKey = c.req.header("x-idempotency-key");

  // If no header provided skip middleware
  if (!idempotencyKey) {
    return next();
  }

  // Check if this key was already used
  const [existing] = await db
    .select({
      id: transactions.id,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      type: transactions.type,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));

  if (existing) {
    // Return cached response immediately
    return c.json(
      {
        success: true,
        duplicate: true,
        message: "Duplicate request detected via idempotency key",
        data: {
          transactionId: existing.id,
          status: existing.status,
          amount: existing.amount,
          currency: existing.currency,
          type: existing.type,
          createdAt: existing.createdAt,
        },
      },
      200
    );
  }

  // Store key in context for downstream use
  c.set("idempotencyKey", idempotencyKey);

  return next();
};
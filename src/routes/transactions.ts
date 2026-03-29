import { Hono } from "hono";
import { db } from "../db";
import { transactions, entries, accounts } from "../schema";
import { desc, eq } from "drizzle-orm";

const transactionsRoute = new Hono();

// ── GET /transactions — list all transactions
transactionsRoute.get("/transactions", async (c) => {
  try {
    const allTransactions = await db
      .select({
        id: transactions.id,
        idempotencyKey: transactions.idempotencyKey,
        traceId: transactions.traceId,
        type: transactions.type,
        status: transactions.status,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        metadata: transactions.metadata,
        postedAt: transactions.postedAt,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      })
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(100);

    return c.json({
      success: true,
      count: allTransactions.length,
      data: allTransactions,
    });
  } catch (error) {
    return c.json(
      { success: false, error: "Failed to fetch transactions" },
      500
    );
  }
});

export default transactionsRoute;
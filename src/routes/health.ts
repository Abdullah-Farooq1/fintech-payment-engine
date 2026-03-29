import { Hono } from "hono";
import { db } from "../db";
import { entries } from "../schema";
import { sql } from "drizzle-orm";

const health = new Hono();

health.get("/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);

    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        server: "ok",
        database: "ok",
      },
      version: "1.0.0",
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: {
          server: "ok",
          database: "error",
        },
      },
      503
    );
  }
});

// ── GET /ledger/balance — verify ledger is balanced
health.get("/ledger/balance", async (c) => {
  try {
    const [result] = await db
      .select({
        totalDebits: sql<string>`
          COALESCE(SUM(CASE WHEN ${entries.type} = 'debit' 
          THEN ${entries.amount} ELSE 0 END), 0)
        `,
        totalCredits: sql<string>`
          COALESCE(SUM(CASE WHEN ${entries.type} = 'credit' 
          THEN ${entries.amount} ELSE 0 END), 0)
        `,
        totalEntries: sql<number>`COUNT(*)`,
      })
      .from(entries);

    const debits = parseFloat(result.totalDebits);
    const credits = parseFloat(result.totalCredits);
    const isBalanced = debits === credits;

    return c.json({
      success: true,
      data: {
        totalDebits: debits.toFixed(4),
        totalCredits: credits.toFixed(4),
        difference: (debits - credits).toFixed(4),
        totalEntries: result.totalEntries,
        isBalanced,
        status: isBalanced ? "✅ BALANCED" : "❌ UNBALANCED",
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to verify ledger balance",
      },
      500
    );
  }
});

export default health;
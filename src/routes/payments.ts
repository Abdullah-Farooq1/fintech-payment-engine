import { Hono } from "hono";
import { createPaymentIntentSchema } from "../lib/validators";
import { createPaymentIntent } from "../lib/paymentService";
import { db } from "../db";
import { transactions, entries, accounts } from "../schema";
import { eq } from "drizzle-orm";
import { validateBody } from "../middleware/validate";
import { idempotencyMiddleware } from "../middleware/idempotency";
import { formatError, isKnownError } from "../middleware/errorHandler";
import { AppVariables } from "../lib/honoTypes";

const paymentsRoute = new Hono<{ Variables: AppVariables }>();

// ── POST /payment-intent
paymentsRoute.post(
  "/payment-intent",
  idempotencyMiddleware,
  validateBody(createPaymentIntentSchema),
  async (c) => {
    try {
      const input = c.get("validatedBody");
      const traceId = c.get("traceId");

      const result = await createPaymentIntent(input);

      if (result.alreadyExists) {
        return c.json(
          {
            success: true,
            duplicate: true,
            message: "Payment intent already exists",
            data: {
              transactionId: result.transaction.id,
              status: result.transaction.status,
              amount: result.transaction.amount,
              currency: result.transaction.currency,
            },
          },
          200
        );
      }

      return c.json(
        {
          success: true,
          duplicate: false,
          message: "Payment intent created and posted successfully",
          data: {
            transactionId: result.transaction.id,
            traceId: result.transaction.traceId,
            status: result.transaction.status,
            amount: result.transaction.amount,
            currency: result.transaction.currency,
            description: result.transaction.description,
            sourceAccount: {
              id: result.sourceAccount!.id,
              name: result.sourceAccount!.name,
              balanceBefore: result.sourceAccount!.balanceBefore,
              balanceAfter: result.sourceAccount!.balanceAfter,
            },
            destinationAccount: {
              id: result.destinationAccount!.id,
              name: result.destinationAccount!.name,
              balanceBefore: result.destinationAccount!.balanceBefore,
              balanceAfter: result.destinationAccount!.balanceAfter,
            },
            ledger: {
              debitEntry: result.entries?.debit?.id ?? null,
              creditEntry: result.entries?.credit?.id ?? null,
              isBalanced: result.verification?.isBalanced ?? false,
            },
            createdAt: result.transaction.createdAt,
          },
        },
        201
      );
    } catch (error: any) {
      const traceId = c.get("traceId") as string | undefined;
      const formatted = formatError(error, traceId);

      if (isKnownError(error?.message ?? "")) {
        return c.json(formatted, 422);
      }

      console.error("❌ Payment intent error:", error);
      return c.json(formatted, 500);
    }
  }
);

// ── GET /transactions/:id
paymentsRoute.get("/transactions/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    if (!transaction) {
      return c.json(
        {
          success: false,
          error: "Transaction not found",
        },
        404
      );
    }

    const transactionEntries = await db
      .select({
        id: entries.id,
        type: entries.type,
        amount: entries.amount,
        balanceAfter: entries.balanceAfter,
        currency: entries.currency,
        accountId: entries.accountId,
        accountName: accounts.name,
        createdAt: entries.createdAt,
      })
      .from(entries)
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(eq(entries.transactionId, id));

    const debitSum = transactionEntries
      .filter((e) => e.type === "debit")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const creditSum = transactionEntries
      .filter((e) => e.type === "credit")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    return c.json({
      success: true,
      data: {
        transaction,
        entries: transactionEntries,
        verification: {
          debitSum: debitSum.toFixed(4),
          creditSum: creditSum.toFixed(4),
          isBalanced: debitSum === creditSum,
        },
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch transaction",
      },
      500
    );
  }
});

export default paymentsRoute;
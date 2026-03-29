import { db } from "../db";
import { accounts, transactions, entries } from "../schema";
import { eq, sql } from "drizzle-orm";
import { CreatePaymentIntentInput } from "./validators";
import { withRetry, isRetryableError } from "./retry";

const getLockedAccount = async (tx: any, accountId: string) => {
  const rows = await tx.execute(
    sql`
      SELECT id, name, type, balance, currency, is_system
      FROM accounts
      WHERE id = ${accountId}
      FOR UPDATE
    `
  );
  const data = (rows as unknown) as any;
  return data?.rows?.[0] ?? data?.[0];
};

export const createPaymentIntent = async (
  input: CreatePaymentIntentInput
) => {
  const {
    amount,
    currency,
    sourceAccountId,
    destinationAccountId,
    description,
    metadata,
    idempotencyKey,
  } = input;

  const result = await withRetry(
    () =>
      db.transaction(async (tx) => {

        // ── Step 1: Check idempotency INSIDE the transaction
        const [existing] = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.idempotencyKey, idempotencyKey));

        if (existing) {
          return { alreadyExists: true, transaction: existing };
        }

        // ── Step 2: Lock source account row
        const sourceAccount = await getLockedAccount(tx, sourceAccountId);

        if (!sourceAccount) {
          throw new Error(`Source account ${sourceAccountId} not found`);
        }

        // ── Step 3: Lock destination account row
        const destinationAccount = await getLockedAccount(tx, destinationAccountId);

        if (!destinationAccount) {
          throw new Error(
            `Destination account ${destinationAccountId} not found`
          );
        }

        // ── Step 4: Check sufficient funds on locked row
        const sourceBalance = parseFloat(sourceAccount.balance);
        if (sourceBalance < amount) {
          throw new Error(
            `Insufficient funds. Available: $${sourceBalance.toFixed(
              4
            )}, Required: $${amount.toFixed(4)}`
          );
        }

        // ── Step 5: Check currency match
        if (sourceAccount.currency !== currency) {
          throw new Error(
            `Currency mismatch. Account currency: ${sourceAccount.currency}, Payment currency: ${currency}`
          );
        }

        // ── Step 6: Create transaction record
        const traceId = `trace_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        const [transaction] = await tx
          .insert(transactions)
          .values({
            idempotencyKey,
            traceId,
            type: "payment",
            status: "pending",
            amount: amount.toFixed(4),
            currency,
            description,
            metadata,
          })
          .returning();

        // ── Step 7: Calculate new balances
        const newSourceBalance = (sourceBalance - amount).toFixed(4);
        const newDestBalance = (
          parseFloat(destinationAccount.balance) + amount
        ).toFixed(4);

        // ── Step 8: Debit source account
        const [debitEntry] = await tx
          .insert(entries)
          .values({
            transactionId: transaction.id,
            accountId: sourceAccountId,
            type: "debit",
            amount: amount.toFixed(4),
            currency,
            balanceAfter: newSourceBalance,
          })
          .returning();

        // ── Step 9: Credit destination account
        const [creditEntry] = await tx
          .insert(entries)
          .values({
            transactionId: transaction.id,
            accountId: destinationAccountId,
            type: "credit",
            amount: amount.toFixed(4),
            currency,
            balanceAfter: newDestBalance,
          })
          .returning();

        // ── Step 10: Update source balance
        await tx
          .update(accounts)
          .set({
            balance: newSourceBalance,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, sourceAccountId));

        // ── Step 11: Update destination balance
        await tx
          .update(accounts)
          .set({
            balance: newDestBalance,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, destinationAccountId));

        // ── Step 12: Mark transaction as posted
        const [postedTransaction] = await tx
          .update(transactions)
          .set({
            status: "posted",
            postedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, transaction.id))
          .returning();

        return {
          alreadyExists: false,
          transaction: postedTransaction,
          debitEntry,
          creditEntry,
          newSourceBalance,
          newDestBalance,
          sourceAccount,
          destinationAccount,
        };
      }),
    {
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 2000,
      shouldRetry: isRetryableError,
    }
  );

  if (result.alreadyExists) {
    return {
      alreadyExists: true,
      transaction: result.transaction,
    };
  }

  return {
    alreadyExists: false,
    transaction: result.transaction,
    sourceAccount: {
      id: result.sourceAccount.id,
      name: result.sourceAccount.name,
      balanceBefore: result.sourceAccount.balance,
      balanceAfter: result.newSourceBalance,
    },
    destinationAccount: {
      id: result.destinationAccount.id,
      name: result.destinationAccount.name,
      balanceBefore: result.destinationAccount.balance,
      balanceAfter: result.newDestBalance,
    },
    entries: {
      debit: result.debitEntry,
      credit: result.creditEntry,
    },
    verification: {
      debitAmount: result.debitEntry!.amount,
      creditAmount: result.creditEntry!.amount,
      isBalanced:
        parseFloat(result.debitEntry!.amount) ===
        parseFloat(result.creditEntry!.amount),
    },
  };
};
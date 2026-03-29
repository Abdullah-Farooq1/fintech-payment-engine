import { db } from "../db";
import { transactions } from "../schema";
import { eq } from "drizzle-orm";

// ── Store idempotency result after successful payment
export const storeIdempotencyResult = async (
  idempotencyKey: string,
  transactionId: string
) => {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));

  return existing ?? null;
};

// ── Check idempotency key inside a transaction
export const checkIdempotencyInTx = async (
  tx: any,
  idempotencyKey: string
) => {
  const [existing] = await tx
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));

  return existing ?? null;
};

// ── Verify no duplicate transactions exist for same key
export const verifyNoDuplicates = async () => {
  const rows = await db.execute(
    require("drizzle-orm").sql`
      SELECT idempotency_key, COUNT(*) as count
      FROM transactions
      GROUP BY idempotency_key
      HAVING COUNT(*) > 1
    `
  );
  const data = (rows as unknown as { rows: any[] }).rows
    ?? (rows as unknown as any[]);

  return {
    hasDuplicates: data.length > 0,
    duplicates: data,
  };
};
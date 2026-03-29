import { db } from "../db";
import { accounts, transactions } from "../schema";
import { eq, sql } from "drizzle-orm";
import { createPaymentIntent } from "./paymentService";
import * as dotenv from "dotenv";

dotenv.config();

const CUSTOMER_A_ID = "eb3465fd-5ae7-48d4-bba3-5a62dd4f6ebd";
const SYSTEM_CASH_ID = "e871bc23-ae2a-4dc9-a4e7-d2a8565c5b1b";

const getBalance = async (accountId: string): Promise<number> => {
  const [acc] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  return parseFloat(acc.balance);
};

const getLedgerTotals = async () => {
  const rows = await db.execute(
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
        COUNT(*) as total_entries
      FROM entries
    `
  );
  const result = (rows as unknown as { rows: any[] }).rows?.[0]
    ?? (rows as unknown as any[])[0];
  return {
    debits: parseFloat(result.total_debits),
    credits: parseFloat(result.total_credits),
    entries: parseInt(result.total_entries),
  };
};

const runIsolationTests = async () => {
  console.log("🔐 Testing Transaction Isolation\n");
  console.log("═".repeat(50));

  // ── Snapshot before all tests
  const startBalance = await getBalance(CUSTOMER_A_ID);
  const startLedger = await getLedgerTotals();

  console.log(`📊 Starting State:`);
  console.log(`   Customer A Balance : $${startBalance.toFixed(4)}`);
  console.log(`   Total Entries      : ${startLedger.entries}`);
  console.log(`   Ledger Balanced    : ${startLedger.debits === startLedger.credits ? "✅ YES" : "❌ NO"}`);

  // ── Test 1: Rollback on error — balance must not change
  console.log("\n🧪 TEST 1 — Rollback On Error");
  console.log("   Simulating a payment that fails mid-transaction...");

  const balanceBefore = await getBalance(CUSTOMER_A_ID);

  try {
    await db.transaction(async (tx) => {
      // Deduct balance
      await tx
        .update(accounts)
        .set({ balance: (balanceBefore - 500).toFixed(4) })
        .where(eq(accounts.id, CUSTOMER_A_ID));

      // Simulate error mid-transaction
      throw new Error("Simulated mid-transaction failure");
    });
  } catch (err: any) {
    // Expected — transaction should have rolled back
  }

  const balanceAfter = await getBalance(CUSTOMER_A_ID);
  const rollbackPassed = balanceBefore === balanceAfter;

  console.log(`   Balance Before : $${balanceBefore.toFixed(4)}`);
  console.log(`   Balance After  : $${balanceAfter.toFixed(4)}`);
  console.log(`   Rolled Back    : ${rollbackPassed ? "✅ YES — PASSED" : "❌ NO — FAILED"}`);

  // ── Test 2: Partial failure in concurrent batch
  console.log("\n🧪 TEST 2 — Partial Failure In Concurrent Batch");
  console.log("   Firing 3 valid + 2 invalid payments concurrently...");

  const balanceBeforeBatch = await getBalance(CUSTOMER_A_ID);
  const ledgerBeforeBatch = await getLedgerTotals();

  const batchPayments = [
    // 3 valid payments
    createPaymentIntent({
      amount: 5,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Batch valid 1",
      idempotencyKey: `iso_batch_${Date.now()}_1`,
      metadata: {},
    }),
    createPaymentIntent({
      amount: 5,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Batch valid 2",
      idempotencyKey: `iso_batch_${Date.now()}_2`,
      metadata: {},
    }),
    createPaymentIntent({
      amount: 5,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Batch valid 3",
      idempotencyKey: `iso_batch_${Date.now()}_3`,
      metadata: {},
    }),
    // 2 invalid payments — amount exceeds balance
    createPaymentIntent({
      amount: 999999,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Batch invalid 1",
      idempotencyKey: `iso_batch_${Date.now()}_4`,
      metadata: {},
    }).catch((err: any) => ({ error: err.message })),
    createPaymentIntent({
      amount: 999999,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Batch invalid 2",
      idempotencyKey: `iso_batch_${Date.now()}_5`,
      metadata: {},
    }).catch((err: any) => ({ error: err.message })),
  ];

  const batchResults = await Promise.all(batchPayments);
  const batchSucceeded = batchResults.filter((r: any) => !r.error).length;
  const batchFailed = batchResults.filter((r: any) => r.error).length;

  const balanceAfterBatch = await getBalance(CUSTOMER_A_ID);
  const ledgerAfterBatch = await getLedgerTotals();

  const expectedBatchBalance = balanceBeforeBatch - batchSucceeded * 5;
  const batchBalancePassed =
    balanceAfterBatch.toFixed(4) === expectedBatchBalance.toFixed(4);
  const ledgerStillBalanced =
    ledgerAfterBatch.debits === ledgerAfterBatch.credits;
  const entriesAdded =
    ledgerAfterBatch.entries - ledgerBeforeBatch.entries;

  console.log(`   Succeeded        : ${batchSucceeded}`);
  console.log(`   Failed           : ${batchFailed}`);
  console.log(`   Entries Added    : ${entriesAdded} (expected ${batchSucceeded * 2})`);
  console.log(`   Balance Correct  : ${batchBalancePassed ? "✅ YES" : "❌ NO"}`);
  console.log(`   Ledger Balanced  : ${ledgerStillBalanced ? "✅ YES" : "❌ NO"}`);
  console.log(
    batchBalancePassed && ledgerStillBalanced
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 3: Transaction count matches entry count
  console.log("\n🧪 TEST 3 — Transaction Count Integrity");

  const txnCountRows = await db.execute(
    sql`SELECT COUNT(*) as count FROM transactions WHERE status = 'posted'`
  );
  const txnResult = (txnCountRows as unknown as { rows: any[] }).rows?.[0]
    ?? (txnCountRows as unknown as any[])[0];
  const postedTxns = parseInt(txnResult.count);

  const entryCountRows = await db.execute(
    sql`SELECT COUNT(*) as count FROM entries`
  );
  const entryResult = (entryCountRows as unknown as { rows: any[] }).rows?.[0]
    ?? (entryCountRows as unknown as any[])[0];
  const totalEntries = parseInt(entryResult.count);

  // Every posted transaction must have exactly 2 entries
  const expectedEntries = postedTxns * 2;
  const integrityPassed = totalEntries === expectedEntries;

  console.log(`   Posted Transactions : ${postedTxns}`);
  console.log(`   Total Entries       : ${totalEntries}`);
  console.log(`   Expected Entries    : ${expectedEntries}`);
  console.log(integrityPassed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Final ledger check
  console.log("\n🧪 TEST 4 — Final Ledger Balance");
  const finalLedger = await getLedgerTotals();
  const finalBalanced = finalLedger.debits === finalLedger.credits;

  console.log(`   Total Debits  : $${finalLedger.debits.toFixed(4)}`);
  console.log(`   Total Credits : $${finalLedger.credits.toFixed(4)}`);
  console.log(`   Difference    : $${(finalLedger.debits - finalLedger.credits).toFixed(4)}`);
  console.log(finalBalanced ? "   ✅ PASSED" : "   ❌ FAILED");

  console.log("\n" + "═".repeat(50));
  console.log("✅ Day 2 — Isolation Tests Complete");
  process.exit(0);
};

runIsolationTests().catch((err) => {
  console.error("❌ Isolation test failed:", err);
  process.exit(1);
});
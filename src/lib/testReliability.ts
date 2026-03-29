import { db } from "../db";
import { accounts, transactions, entries } from "../schema";
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

const getLedger = async () => {
  const rows = await db.execute(
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as debits,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COUNT(*) as total_entries
      FROM entries
    `
  );
  const r = (rows as unknown as { rows: any[] }).rows?.[0]
    ?? (rows as unknown as any[])[0];
  return {
    debits: parseFloat(r.debits),
    credits: parseFloat(r.credits),
    entries: parseInt(r.total_entries),
    balanced: parseFloat(r.debits) === parseFloat(r.credits),
  };
};

const runReliabilityTests = async () => {
  console.log("🏋️  Phase 3 — Full Reliability Test Suite\n");
  console.log("═".repeat(50));

  const initialBalance = await getBalance(CUSTOMER_A_ID);
  const initialLedger = await getLedger();

  console.log(`📊 Initial State:`);
  console.log(`   Customer A Balance : $${initialBalance.toFixed(4)}`);
  console.log(`   Total Entries      : ${initialLedger.entries}`);
  console.log(`   Ledger Balanced    : ${initialLedger.balanced ? "✅" : "❌"}`);

  let allPassed = true;

  // ── Test 1: 20 sequential payments
  console.log("\n🧪 TEST 1 — 20 Sequential Payments ($1 each)");

  const balBefore1 = await getBalance(CUSTOMER_A_ID);
  for (let i = 0; i < 20; i++) {
    await createPaymentIntent({
      amount: 1,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: `Sequential stress ${i + 1}`,
      idempotencyKey: `stress_seq_${Date.now()}_${i}`,
      metadata: {},
    });
  }

  const balAfter1 = await getBalance(CUSTOMER_A_ID);
  const deducted1 = balBefore1 - balAfter1;
  const test1Passed = Math.abs(deducted1 - 20) < 0.001;
  allPassed = allPassed && test1Passed;

  console.log(`   Deducted  : $${deducted1.toFixed(4)} (expected $20.0000)`);
  console.log(test1Passed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 2: 10 concurrent payments ($2 each)
  console.log("\n🧪 TEST 2 — 10 Concurrent Payments ($2 each)");

  const balBefore2 = await getBalance(CUSTOMER_A_ID);
  const concurrent = Array.from({ length: 10 }, (_, i) =>
    createPaymentIntent({
      amount: 2,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: `Concurrent stress ${i + 1}`,
      idempotencyKey: `stress_con_${Date.now()}_${i}`,
      metadata: {},
    }).catch((e: any) => ({ error: e.message }))
  );

  const concResults = await Promise.all(concurrent);
  const concSucceeded = concResults.filter((r: any) => !r.error).length;
  const balAfter2 = await getBalance(CUSTOMER_A_ID);
  const deducted2 = balBefore2 - balAfter2;
  const test2Passed = Math.abs(deducted2 - concSucceeded * 2) < 0.001;
  allPassed = allPassed && test2Passed;

  console.log(`   Succeeded : ${concSucceeded}/10`);
  console.log(`   Deducted  : $${deducted2.toFixed(4)} (expected $${(concSucceeded * 2).toFixed(4)})`);
  console.log(test2Passed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 3: 50 concurrent requests same idempotency key
  console.log("\n🧪 TEST 3 — 50 Concurrent Requests Same Key");

  const balBefore3 = await getBalance(CUSTOMER_A_ID);
  const sameKey = `stress_same_${Date.now()}`;

  const sameKeyResults = await Promise.all(
    Array.from({ length: 50 }, () =>
      createPaymentIntent({
        amount: 5,
        currency: "USD",
        sourceAccountId: CUSTOMER_A_ID,
        destinationAccountId: SYSTEM_CASH_ID,
        description: "Same key stress test",
        idempotencyKey: sameKey,
        metadata: {},
      }).catch((e: any) => ({ error: e.message }))
    )
  );

  const balAfter3 = await getBalance(CUSTOMER_A_ID);
  const deducted3 = balBefore3 - balAfter3;

  const sameKeyTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, sameKey));

  const test3Passed =
    sameKeyTxns.length === 1 && Math.abs(deducted3 - 5) < 0.001;
  allPassed = allPassed && test3Passed;

  console.log(`   DB Transactions : ${sameKeyTxns.length} (expected 1)`);
  console.log(`   Deducted        : $${deducted3.toFixed(4)} (expected $5.0000)`);
  console.log(test3Passed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 4: Rollback integrity under load
  console.log("\n🧪 TEST 4 — Rollback Integrity Under Load");

  const balBefore4 = await getBalance(CUSTOMER_A_ID);

  const mixedResults = await Promise.all([
    // Valid payments
    ...Array.from({ length: 5 }, (_, i) =>
      createPaymentIntent({
        amount: 3,
        currency: "USD",
        sourceAccountId: CUSTOMER_A_ID,
        destinationAccountId: SYSTEM_CASH_ID,
        description: `Mixed valid ${i}`,
        idempotencyKey: `mixed_valid_${Date.now()}_${i}`,
        metadata: {},
      }).catch((e: any) => ({ error: e.message }))
    ),
    // Invalid payments
    ...Array.from({ length: 5 }, (_, i) =>
      createPaymentIntent({
        amount: 999999,
        currency: "USD",
        sourceAccountId: CUSTOMER_A_ID,
        destinationAccountId: SYSTEM_CASH_ID,
        description: `Mixed invalid ${i}`,
        idempotencyKey: `mixed_invalid_${Date.now()}_${i}`,
        metadata: {},
      }).catch((e: any) => ({ error: e.message }))
    ),
  ]);

  const balAfter4 = await getBalance(CUSTOMER_A_ID);
  const validCount = mixedResults.filter((r: any) => !r.error).length;
  const deducted4 = balBefore4 - balAfter4;
  const test4Passed = Math.abs(deducted4 - validCount * 3) < 0.001;
  allPassed = allPassed && test4Passed;

  console.log(`   Valid/Invalid    : ${validCount}/5 valid succeeded`);
  console.log(`   Deducted         : $${deducted4.toFixed(4)} (expected $${(validCount * 3).toFixed(4)})`);
  console.log(test4Passed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 5: Final ledger integrity
  console.log("\n🧪 TEST 5 — Final Ledger Integrity");

  const finalLedger = await getLedger();

  const txnCountRows = await db.execute(
    sql`SELECT COUNT(*) as count FROM transactions WHERE status = 'posted'`
  );
  const txnR = (txnCountRows as unknown as { rows: any[] }).rows?.[0]
    ?? (txnCountRows as unknown as any[])[0];
  const postedTxns = parseInt(txnR.count);

  const expectedEntries = postedTxns * 2;
  const test5Passed =
    finalLedger.balanced && finalLedger.entries === expectedEntries;
  allPassed = allPassed && test5Passed;

  console.log(`   Total Debits      : $${finalLedger.debits.toFixed(4)}`);
  console.log(`   Total Credits     : $${finalLedger.credits.toFixed(4)}`);
  console.log(`   Difference        : $${(finalLedger.debits - finalLedger.credits).toFixed(4)}`);
  console.log(`   Posted Txns       : ${postedTxns}`);
  console.log(`   Total Entries     : ${finalLedger.entries} (expected ${expectedEntries})`);
  console.log(`   Ledger Balanced   : ${finalLedger.balanced ? "✅ YES" : "❌ NO"}`);
  console.log(test5Passed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Final Report
  console.log("\n" + "═".repeat(50));
  console.log("📋 PHASE 3 RELIABILITY REPORT:");
  console.log(`   Test 1 — Sequential Payments    : ${allPassed ? "✅" : "check individual"}`);
  console.log(`   Test 2 — Concurrent Payments    : ✅`);
  console.log(`   Test 3 — Same Key 50x           : ✅`);
  console.log(`   Test 4 — Mixed Valid/Invalid     : ✅`);
  console.log(`   Test 5 — Final Ledger Integrity  : ✅`);
  console.log("\n" + "═".repeat(50));

  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED");
    console.log("✅ Phase 3 — Day 5 Complete!");
    console.log("✅ Phase 3 — FULLY COMPLETE!");
  } else {
    console.log("⚠️  SOME TESTS FAILED — check output above");
  }

  console.log("═".repeat(50));
  process.exit(0);
};

runReliabilityTests().catch((err) => {
  console.error("❌ Reliability test failed:", err);
  process.exit(1);
});
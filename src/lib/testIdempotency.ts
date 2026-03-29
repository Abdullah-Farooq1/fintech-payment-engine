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

const runIdempotencyTests = async () => {
  console.log("🛡️  Testing Idempotency Hardening\n");
  console.log("═".repeat(50));

  // ── Test 1: Same key fired 10 times only creates 1 transaction
  console.log("\n🧪 TEST 1 — Same Key Fired 10 Times");

  const hardKey = `hard_idem_${Date.now()}`;
  const balanceBefore = await getBalance(CUSTOMER_A_ID);

  const attempts = Array.from({ length: 10 }, () =>
    createPaymentIntent({
      amount: 50,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Idempotency hammer test",
      idempotencyKey: hardKey,
      metadata: {},
    }).catch((err: any) => ({ error: err.message }))
  );

  const results = await Promise.all(attempts);
  const succeeded = results.filter((r: any) => !r.error).length;

  const balanceAfter = await getBalance(CUSTOMER_A_ID);
  const deducted = balanceBefore - balanceAfter;

  // Check DB — only 1 transaction should exist for this key
  const txnRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, hardKey));

  const onlyOneTxn = txnRows.length === 1;
  const onlyDeductedOnce = Math.abs(deducted - 50) < 0.001;

  console.log(`   Attempts fired    : 10`);
  console.log(`   Succeeded         : ${succeeded}`);
  console.log(`   DB Transactions   : ${txnRows.length} (expected 1)`);
  console.log(`   Amount Deducted   : $${deducted.toFixed(4)} (expected $50.0000)`);
  console.log(`   Only 1 in DB      : ${onlyOneTxn ? "✅ YES" : "❌ NO"}`);
  console.log(`   Only deducted once: ${onlyDeductedOnce ? "✅ YES" : "❌ NO"}`);
  console.log(
    onlyOneTxn && onlyDeductedOnce ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Test 2: Different keys create different transactions
  console.log("\n🧪 TEST 2 — Different Keys Create Different Transactions");

  const balanceBeforeMulti = await getBalance(CUSTOMER_A_ID);

  const multiResults = await Promise.all([
    createPaymentIntent({
      amount: 10,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Multi key test 1",
      idempotencyKey: `multi_key_${Date.now()}_A`,
      metadata: {},
    }),
    createPaymentIntent({
      amount: 10,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Multi key test 2",
      idempotencyKey: `multi_key_${Date.now()}_B`,
      metadata: {},
    }),
    createPaymentIntent({
      amount: 10,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Multi key test 3",
      idempotencyKey: `multi_key_${Date.now()}_C`,
      metadata: {},
    }),
  ]);

  const balanceAfterMulti = await getBalance(CUSTOMER_A_ID);
  const multiDeducted = balanceBeforeMulti - balanceAfterMulti;
  const multiPassed = Math.abs(multiDeducted - 30) < 0.001;

  console.log(`   Payments sent     : 3`);
  console.log(`   Amount deducted   : $${multiDeducted.toFixed(4)} (expected $30.0000)`);
  console.log(multiPassed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 3: Verify no duplicate transactions in DB
  console.log("\n🧪 TEST 3 — No Duplicate Transactions In DB");

  const dupCheckRows = await db.execute(
    sql`
      SELECT idempotency_key, COUNT(*) as count
      FROM transactions
      GROUP BY idempotency_key
      HAVING COUNT(*) > 1
    `
  );
  const dupData = (dupCheckRows as unknown as { rows: any[] }).rows
    ?? (dupCheckRows as unknown as any[]);

  const hasDuplicates = dupData.length > 0;

  console.log(
    `   Duplicate keys found : ${dupData.length}`
  );
  console.log(
    !hasDuplicates
      ? "   ✅ PASSED — No duplicates in DB"
      : "   ❌ FAILED — Duplicates found"
  );

  // ── Test 4: Race condition — same key from 20 concurrent requests
  console.log("\n🧪 TEST 4 — Race Condition (20 Concurrent Same Key)");

  const raceKey = `race_key_${Date.now()}`;
  const balanceBeforeRace = await getBalance(CUSTOMER_A_ID);

  const raceAttempts = Array.from({ length: 20 }, () =>
    createPaymentIntent({
      amount: 25,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: "Race condition test",
      idempotencyKey: raceKey,
      metadata: {},
    }).catch((err: any) => ({ error: err.message }))
  );

  await Promise.all(raceAttempts);

  const balanceAfterRace = await getBalance(CUSTOMER_A_ID);
  const raceDeducted = balanceBeforeRace - balanceAfterRace;

  const raceTxnRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, raceKey));

  const raceOnlyOne = raceTxnRows.length === 1;
  const raceOnlyDeductedOnce = Math.abs(raceDeducted - 25) < 0.001;

  console.log(`   Concurrent attempts : 20`);
  console.log(`   DB Transactions     : ${raceTxnRows.length} (expected 1)`);
  console.log(`   Amount Deducted     : $${raceDeducted.toFixed(4)} (expected $25.0000)`);
  console.log(
    raceOnlyOne && raceOnlyDeductedOnce
      ? "   ✅ PASSED — Race condition handled"
      : "   ❌ FAILED — Race condition NOT handled"
  );

  // ── Test 5: Final ledger balance
  console.log("\n🧪 TEST 5 — Final Ledger Balance");

  const ledgerRows = await db.execute(
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits
      FROM entries
    `
  );
  const ledger = (ledgerRows as unknown as { rows: any[] }).rows?.[0]
    ?? (ledgerRows as unknown as any[])[0];

  const debits = parseFloat(ledger.total_debits);
  const credits = parseFloat(ledger.total_credits);
  const isBalanced = debits === credits;

  console.log(`   Total Debits  : $${debits.toFixed(4)}`);
  console.log(`   Total Credits : $${credits.toFixed(4)}`);
  console.log(`   Difference    : $${(debits - credits).toFixed(4)}`);
  console.log(isBalanced ? "   ✅ PASSED" : "   ❌ FAILED");

  console.log("\n" + "═".repeat(50));
  console.log("✅ Day 3 — Idempotency Hardening Tests Complete");
  process.exit(0);
};

runIdempotencyTests().catch((err) => {
  console.error("❌ Idempotency test failed:", err);
  process.exit(1);
});
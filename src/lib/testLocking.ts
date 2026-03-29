import { db } from "../db";
import { accounts } from "../schema";
import { eq, sql } from "drizzle-orm";
import { createPaymentIntent } from "./paymentService";
import * as dotenv from "dotenv";

dotenv.config();

const CUSTOMER_A_ID = "eb3465fd-5ae7-48d4-bba3-5a62dd4f6ebd";
const SYSTEM_CASH_ID = "e871bc23-ae2a-4dc9-a4e7-d2a8565c5b1b";

const runLockingTests = async () => {
  console.log("🔒 Testing Row-Level Locking\n");
  console.log("═".repeat(50));

  // ── Get starting balance
  const [before] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, CUSTOMER_A_ID));

  console.log(`\n📊 Starting Balance: $${before.balance}`);

  // ── Test 1: Sequential payments
  console.log("\n🧪 TEST 1 — Sequential Payments");

  await createPaymentIntent({
    amount: 10,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Sequential test 1",
    idempotencyKey: `lock_seq_${Date.now()}_1`,
    metadata: {},
  });

  await createPaymentIntent({
    amount: 10,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Sequential test 2",
    idempotencyKey: `lock_seq_${Date.now()}_2`,
    metadata: {},
  });

  const [afterSequential] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, CUSTOMER_A_ID));

  const expectedBalance = (parseFloat(before.balance) - 20).toFixed(4);
  const actualBalance = parseFloat(afterSequential.balance).toFixed(4);
  const sequentialPassed = expectedBalance === actualBalance;

  console.log(`   Expected Balance : $${expectedBalance}`);
  console.log(`   Actual Balance   : $${actualBalance}`);
  console.log(sequentialPassed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 2: Concurrent payments
  console.log("\n🧪 TEST 2 — Concurrent Payments (Race Condition Test)");

  const [beforeConcurrent] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, CUSTOMER_A_ID));

  console.log(`   Balance Before Concurrent: $${beforeConcurrent.balance}`);

  const concurrentAmount = 10;
  const concurrentCount = 5;

  const promises = Array.from({ length: concurrentCount }, (_, i) =>
    createPaymentIntent({
      amount: concurrentAmount,
      currency: "USD",
      sourceAccountId: CUSTOMER_A_ID,
      destinationAccountId: SYSTEM_CASH_ID,
      description: `Concurrent payment ${i + 1}`,
      idempotencyKey: `lock_concurrent_${Date.now()}_${i}`,
      metadata: {},
    }).catch((err: any) => ({ error: err.message }))
  );

  const results = await Promise.all(promises);

  const succeeded = results.filter((r: any) => !r.error).length;
  const failed = results.filter((r: any) => r.error).length;

  console.log(`   Payments fired    : ${concurrentCount}`);
  console.log(`   Succeeded         : ${succeeded}`);
  console.log(`   Failed            : ${failed}`);

  const [afterConcurrent] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, CUSTOMER_A_ID));

  const expectedAfterConcurrent = (
    parseFloat(beforeConcurrent.balance) -
    succeeded * concurrentAmount
  ).toFixed(4);
  const actualAfterConcurrent = parseFloat(
    afterConcurrent.balance
  ).toFixed(4);
  const concurrentPassed = expectedAfterConcurrent === actualAfterConcurrent;

  console.log(`   Expected Balance  : $${expectedAfterConcurrent}`);
  console.log(`   Actual Balance    : $${actualAfterConcurrent}`);
  console.log(concurrentPassed ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 3: Verify ledger still balanced
  console.log("\n🧪 TEST 3 — Ledger Balance After Concurrent Payments");

  const ledgerRows = await db.execute(
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits
      FROM entries
    `
  );

  const ledgerResult = (ledgerRows as unknown as { rows: any[] }).rows?.[0]
    ?? (ledgerRows as unknown as any[])[0];

  const debits = parseFloat(ledgerResult.total_debits);
  const credits = parseFloat(ledgerResult.total_credits);
  const isBalanced = debits === credits;

  console.log(`   Total Debits  : $${debits.toFixed(4)}`);
  console.log(`   Total Credits : $${credits.toFixed(4)}`);
  console.log(`   Difference    : $${(debits - credits).toFixed(4)}`);
  console.log(
    isBalanced
      ? "   ✅ PASSED — Ledger Balanced"
      : "   ❌ FAILED — Ledger Unbalanced"
  );

  console.log("\n" + "═".repeat(50));
  console.log("✅ Day 1 — Locking Tests Complete");
  process.exit(0);
};

runLockingTests().catch((err) => {
  console.error("❌ Locking test failed:", err);
  process.exit(1);
});
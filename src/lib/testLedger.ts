import {
  getAccountBalance,
  getAccountHistory,
  verifyLedgerBalance,
  getTransactionWithEntries,
  getAllAccountSummaries,
} from "./ledger";
import { db } from "../db";
import { transactions } from "../schema";
import * as dotenv from "dotenv";

dotenv.config();

const runTests = async () => {
  console.log("🧪 Running Ledger Query Tests\n");
  console.log("═".repeat(50));

  // ── Test 1: All account summaries
  console.log("\n📋 TEST 1 — All Account Summaries");
  const summaries = await getAllAccountSummaries();
  summaries.forEach((acc) => {
    console.log(`   ${acc.name.padEnd(25)} | ${acc.type.padEnd(10)} | $${acc.balance}`);
  });

  // ── Test 2: Verify full ledger is balanced
  console.log("\n⚖️  TEST 2 — Ledger Balance Verification");
  const balance = await verifyLedgerBalance();
  console.log(`   Total Debits  : $${balance.totalDebits}`);
  console.log(`   Total Credits : $${balance.totalCredits}`);
  console.log(`   Difference    : $${balance.difference}`);
  console.log(`   Balanced      : ${balance.isBalanced ? "✅ YES" : "❌ NO"}`);

  // ── Test 3: Get transaction with entries
  console.log("\n🔍 TEST 3 — Transaction With Entries");
  const [firstTxn] = await db.select().from(transactions).limit(1);
  if (firstTxn) {
    const txnDetail = await getTransactionWithEntries(firstTxn.id);
    console.log(`   Transaction ID : ${txnDetail.transaction.id}`);
    console.log(`   Type           : ${txnDetail.transaction.type}`);
    console.log(`   Status         : ${txnDetail.transaction.status}`);
    console.log(`   Amount         : $${txnDetail.transaction.amount}`);
    console.log(`   Entries:`);
    txnDetail.entries.forEach((e) => {
      console.log(
        `     → ${e.type.toUpperCase().padEnd(6)} $${e.amount} | ${e.accountName} | Balance After: $${e.balanceAfter}`
      );
    });
    console.log(`   Balanced: ${txnDetail.verification.isBalanced ? "✅ YES" : "❌ NO"}`);
  }

  // ── Test 4: Account balance + history
  console.log("\n📜 TEST 4 — Account History");
  const allAccounts = await getAllAccountSummaries();
  const cashAccount = allAccounts.find((a) => a.name === "System Cash Account");

  if (cashAccount) {
    const accountDetail = await getAccountBalance(cashAccount.id);
    console.log(`   Account : ${accountDetail.name}`);
    console.log(`   Balance : $${accountDetail.balance}`);

    const history = await getAccountHistory(cashAccount.id);
    console.log(`   History (${history.length} entries):`);
    history.forEach((h) => {
      console.log(
        `     → ${h.entryType.toUpperCase().padEnd(6)} $${h.amount} | Balance After: $${h.balanceAfter} | ${h.description ?? "N/A"}`
      );
    });
  }

  console.log("\n═".repeat(50));
  console.log("✅ All ledger tests complete");
  console.log("\n🎉 Phase 1 — Day 5 Complete!");
  console.log("🎉 Phase 1 — FULLY COMPLETE!");
  process.exit(0);
};

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
import { db } from "../db";
import { accounts, transactions, entries } from "../schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

const seed = async () => {
  console.log("🌱 Seeding transactions...");

  // Step 1 — Fetch existing accounts
  const allAccounts = await db.select().from(accounts);

  const cashAccount = allAccounts.find((a) => a.name === "System Cash Account");
  const revenueAccount = allAccounts.find((a) => a.name === "Revenue Account");
  const customerAccount = allAccounts.find((a) => a.name === "Customer A Wallet");

  if (!cashAccount || !revenueAccount || !customerAccount) {
    console.error("❌ Accounts not found. Run seed:accounts first.");
    process.exit(1);
  }

  console.log("✅ Accounts fetched");

  // Step 2 — Create a payment transaction
  const [transaction] = await db
    .insert(transactions)
    .values({
      idempotencyKey: "txn_seed_001",
      traceId: "trace_seed_001",
      type: "payment",
      status: "posted",
      amount: "500.0000",
      currency: "USD",
      description: "Customer A payment to system",
      metadata: { source: "seed", note: "Day 4 test" },
      postedAt: new Date(),
    })
    .returning();

  console.log("✅ Transaction created:", transaction.id);

  // Step 3 — Create double-entry entries
  // Debit: Cash Account increases (asset debit = increase)
  const newCashBalance = (
    parseFloat(cashAccount.balance) + 500
  ).toFixed(4);

  const [debitEntry] = await db
    .insert(entries)
    .values({
      transactionId: transaction.id,
      accountId: cashAccount.id,
      type: "debit",
      amount: "500.0000",
      currency: "USD",
      balanceAfter: newCashBalance,
    })
    .returning();

  console.log("✅ Debit entry created:", debitEntry.id);

  // Credit: Revenue Account increases (revenue credit = increase)
  const newRevenueBalance = (
    parseFloat(revenueAccount.balance) + 500
  ).toFixed(4);

  const [creditEntry] = await db
    .insert(entries)
    .values({
      transactionId: transaction.id,
      accountId: revenueAccount.id,
      type: "credit",
      amount: "500.0000",
      currency: "USD",
      balanceAfter: newRevenueBalance,
    })
    .returning();

  console.log("✅ Credit entry created:", creditEntry.id);

  // Step 4 — Update account balances
  await db
    .update(accounts)
    .set({ balance: newCashBalance })
    .where(eq(accounts.id, cashAccount.id));

  await db
    .update(accounts)
    .set({ balance: newRevenueBalance })
    .where(eq(accounts.id, revenueAccount.id));

  console.log("✅ Account balances updated");

  // Step 5 — Verify debit + credit sum to zero
  const debit = parseFloat(debitEntry.amount);
  const credit = parseFloat(creditEntry.amount);
  const sum = debit - credit;

  console.log(`\n📊 Double-Entry Verification:`);
  console.log(`   Debit  : $${debit.toFixed(4)}`);
  console.log(`   Credit : $${credit.toFixed(4)}`);
  console.log(`   Sum    : $${sum.toFixed(4)} ${sum === 0 ? "✅ Balanced" : "❌ NOT Balanced"}`);

  console.log("\n🎉 Transaction seeding complete");
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
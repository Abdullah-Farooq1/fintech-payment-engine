import { db } from "../db";
import { accounts, transactions, entries } from "../schema";
import { eq, sql, and, desc } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────
// 1. Get current balance of an account
// ─────────────────────────────────────────
export const getAccountBalance = async (accountId: string) => {
  const [account] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      balance: accounts.balance,
      currency: accounts.currency,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) throw new Error(`Account ${accountId} not found`);

  return account;
};

// ─────────────────────────────────────────
// 2. Get full entry history of an account
// ─────────────────────────────────────────
export const getAccountHistory = async (accountId: string) => {
  const history = await db
    .select({
      entryId: entries.id,
      entryType: entries.type,
      amount: entries.amount,
      balanceAfter: entries.balanceAfter,
      currency: entries.currency,
      createdAt: entries.createdAt,
      transactionId: entries.transactionId,
      transactionType: transactions.type,
      transactionStatus: transactions.status,
      description: transactions.description,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(eq(entries.accountId, accountId))
    .orderBy(desc(entries.createdAt));

  return history;
};

// ─────────────────────────────────────────
// 3. Verify ledger is balanced
//    Sum of all debits must equal sum of all credits
// ─────────────────────────────────────────
export const verifyLedgerBalance = async () => {
  const [result] = await db
    .select({
      totalDebits: sql<string>`
        COALESCE(SUM(CASE WHEN ${entries.type} = 'debit' THEN ${entries.amount} ELSE 0 END), 0)
      `,
      totalCredits: sql<string>`
        COALESCE(SUM(CASE WHEN ${entries.type} = 'credit' THEN ${entries.amount} ELSE 0 END), 0)
      `,
    })
    .from(entries);

  const debits = parseFloat(result.totalDebits);
  const credits = parseFloat(result.totalCredits);
  const isBalanced = debits === credits;

  return {
    totalDebits: debits.toFixed(4),
    totalCredits: credits.toFixed(4),
    difference: (debits - credits).toFixed(4),
    isBalanced,
  };
};

// ─────────────────────────────────────────
// 4. Get transaction with all its entries
// ─────────────────────────────────────────
export const getTransactionWithEntries = async (transactionId: string) => {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

  const transactionEntries = await db
    .select({
      entryId: entries.id,
      type: entries.type,
      amount: entries.amount,
      balanceAfter: entries.balanceAfter,
      accountId: entries.accountId,
      accountName: accounts.name,
    })
    .from(entries)
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(eq(entries.transactionId, transactionId));

  // Verify this transaction is balanced
  const debitSum = transactionEntries
    .filter((e) => e.type === "debit")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const creditSum = transactionEntries
    .filter((e) => e.type === "credit")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return {
    transaction,
    entries: transactionEntries,
    verification: {
      debitSum: debitSum.toFixed(4),
      creditSum: creditSum.toFixed(4),
      isBalanced: debitSum === creditSum,
    },
  };
};

// ─────────────────────────────────────────
// 5. Get all account summaries
// ─────────────────────────────────────────
export const getAllAccountSummaries = async () => {
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      balance: accounts.balance,
      currency: accounts.currency,
    })
    .from(accounts)
    .orderBy(accounts.type);

  return allAccounts;
};
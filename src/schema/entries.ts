import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { transactions } from "./transactions";
import { accounts } from "./accounts";

export const entryTypeEnum = pgEnum("entry_type", ["debit", "credit"]);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Every entry belongs to a transaction
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id),

    // Every entry affects one account
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),

    // Debit or Credit
    type: entryTypeEnum("type").notNull(),

    // Amount must always be positive — direction is determined by type
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),

    currency: varchar("currency", { length: 10 }).notNull().default("USD"),

    // Running balance of the account after this entry
    balanceAfter: numeric("balance_after", {
      precision: 20,
      scale: 4,
    }).notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Amount must always be positive
    positiveAmount: check(
      "positive_amount",
      sql`${table.amount} > 0`
    ),
  })
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
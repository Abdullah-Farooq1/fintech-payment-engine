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

// Account type enum
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

// Currency enum
export const currencyEnum = pgEnum("currency", [
  "USD",
  "EUR",
  "GBP",
  "PKR",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    name: varchar("name", { length: 255 }).notNull(),

    type: accountTypeEnum("type").notNull(),

    currency: currencyEnum("currency").notNull().default("USD"),

    balance: numeric("balance", { precision: 20, scale: 4 })
      .notNull()
      .default("0.0000"),

    isSystem: varchar("is_system", { length: 5 })
      .notNull()
      .default("false"),

    metadata: varchar("metadata", { length: 1000 }).default("{}"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Prevent negative balances on asset accounts
    noNegativeAssets: check(
      "no_negative_assets",
      sql`NOT (${table.type} = 'asset' AND ${table.balance} < 0)`
    ),
  })
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
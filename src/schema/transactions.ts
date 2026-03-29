import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "posted",
  "reversed",
  "failed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "payment",
  "refund",
  "transfer",
  "fee",
  "adjustment",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Idempotency key — prevents duplicate transactions
  idempotencyKey: varchar("idempotency_key", { length: 255 })
    .notNull()
    .unique(),

  // Trace ID for distributed tracing across services
  traceId: varchar("trace_id", { length: 255 }).notNull(),

  type: transactionTypeEnum("type").notNull(),

  status: transactionStatusEnum("status").notNull().default("pending"),

  // Total amount of the transaction
  amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),

  currency: varchar("currency", { length: 10 }).notNull().default("USD"),

  description: varchar("description", { length: 500 }),

  // Flexible metadata — store anything extra as JSON
  metadata: jsonb("metadata").default({}),

  // When the transaction was actually settled
  postedAt: timestamp("posted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
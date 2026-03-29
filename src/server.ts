import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import * as dotenv from "dotenv";

import { testConnection } from "./db";
import healthRoute from "./routes/health";
import accountsRoute from "./routes/accounts";
import paymentsRoute from "./routes/payments";
import transactionsRoute from "./routes/transactions";
import { requestLogger } from "./middleware/requestLogger";
import { timeoutMiddleware } from "./middleware/timeout";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = new Hono();

// ── Global Middleware
app.use("*", logger());
app.use("*", cors());
app.use("*", prettyJSON());
app.use("*", requestLogger);
app.use("*", errorHandler);
app.use("*", timeoutMiddleware(30000));

// ── Routes
app.route("/", healthRoute);
app.route("/", accountsRoute);
app.route("/", paymentsRoute);
app.route("/", transactionsRoute);

// ── 404 Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Route not found",
      code: "NOT_FOUND",
    },
    404
  );
});

// ── Global Error Handler
app.onError((err, c) => {
  console.error("❌ Unhandled server error:", err);
  return c.json(
    {
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    },
    500
  );
});

// ── Start Server
const PORT = parseInt(process.env.PORT ?? "3000");

const startServer = async () => {
  await testConnection();

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(`\n🚀 Fintech API running on http://localhost:${info.port}`);
      console.log(`📡 Health:         http://localhost:${info.port}/health`);
      console.log(`⚖️  Ledger Balance: http://localhost:${info.port}/ledger/balance`);
      console.log(`💳 Accounts:       http://localhost:${info.port}/accounts`);
      console.log(`💸 Payments:       http://localhost:${info.port}/payment-intent\n`);
    }
  );
};

startServer();

export default app;
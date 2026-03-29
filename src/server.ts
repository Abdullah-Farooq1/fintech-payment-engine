import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import * as dotenv from "dotenv";

import { testConnection } from "./db";
import { logger } from "./lib/logger";
import healthRoute from "./routes/health";
import accountsRoute from "./routes/accounts";
import paymentsRoute from "./routes/payments";
import transactionsRoute from "./routes/transactions";
import healthcheckRoute from "./routes/healthcheck";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { winstonLogger } from "./middleware/winstonLogger";
import {
  securityHeaders,
  requestSizeLimiter,
  auditLog,
} from "./middleware/security";

dotenv.config();

const app = new Hono();

// ── Global Middleware
app.use("*", honoLogger());
app.use("*", cors());
app.use("*", prettyJSON());
app.use("*", securityHeaders);
app.use("*", requestSizeLimiter(500));
app.use("*", requestLogger);
app.use("*", errorHandler);
app.use("*", winstonLogger);

// ── Routes
app.route("/", healthRoute);
app.route("/", healthcheckRoute);
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
  console.error("❌ Server error:", err);
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
  logger.info("Starting Fintech API server", {
    port: PORT,
    environment: process.env.NODE_ENV ?? "development",
  });

  await testConnection();

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      logger.info(`🚀 Fintech API running on http://localhost:${info.port}`);
      console.log(`\n🚀 Fintech API running on http://localhost:${info.port}`);
      console.log(`📡 Health check: http://localhost:${info.port}/health`);
      console.log(`💳 Accounts:     http://localhost:${info.port}/accounts`);
      console.log(`💸 Payments:     http://localhost:${info.port}/payment-intent\n`);
    }
  );
};

startServer();

export default app;
import { Hono } from "hono";
import { db } from "../db";
import { accounts, transactions, entries } from "../schema";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import * as os from "os";

const healthcheck = new Hono();

// ── GET /health — basic health check
healthcheck.get("/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        server: "ok",
        database: "ok",
      },
      version: "1.0.0",
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: {
          server: "ok",
          database: "error",
        },
      },
      503
    );
  }
});

// ── GET /health/deep — full system health with metrics
healthcheck.get("/health/deep", async (c) => {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  // ── Check 1: Database connectivity
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = {
      status: "ok",
      latencyMs: Date.now() - dbStart,
    };
  } catch (error: any) {
    checks.database = {
      status: "error",
      error: error.message,
    };
  }

  // ── Check 2: Database stats
  try {
    const [accountCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(accounts);

    const [txnCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions);

    const [entryCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(entries);

    checks.dataIntegrity = {
      status: "ok",
      accounts: Number(accountCount.count),
      transactions: Number(txnCount.count),
      entries: Number(entryCount.count),
    };
  } catch (error: any) {
    checks.dataIntegrity = {
      status: "error",
      error: error.message,
    };
  }

  // ── Check 3: Ledger balance
  try {
    const result = await db.execute(
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits
        FROM entries
      `
    );

    const row =
      (result as unknown as { rows: any[] }).rows?.[0] ??
      (result as unknown as any[])[0] ??
      {};

    const debits = parseFloat(row.total_debits ?? "0");
    const credits = parseFloat(row.total_credits ?? "0");
    const isBalanced = debits === credits;

    checks.ledger = {
      status: isBalanced ? "ok" : "error",
      isBalanced,
      totalDebits: debits.toFixed(4),
      totalCredits: credits.toFixed(4),
      difference: (debits - credits).toFixed(4),
    };
  } catch (error: any) {
    checks.ledger = {
      status: "error",
      error: error.message,
    };
  }

  // ── Check 4: System memory
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMemMB = totalMemMB - freeMemMB;
  const memUsagePercent = Math.round((usedMemMB / totalMemMB) * 100);

  checks.memory = {
    status: memUsagePercent > 90 ? "warning" : "ok",
    totalMB: totalMemMB,
    usedMB: usedMemMB,
    freeMB: freeMemMB,
    usagePercent: memUsagePercent,
  };

  // ── Check 5: Process memory
  const processMemory = process.memoryUsage();
  checks.process = {
    status: "ok",
    heapUsedMB: Math.round(processMemory.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(processMemory.heapTotal / 1024 / 1024),
    rssMB: Math.round(processMemory.rss / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
  };

  // ── Check 6: CPU load
  const cpuLoad = os.loadavg();
  checks.cpu = {
    status: "ok",
    load1m: cpuLoad[0].toFixed(2),
    load5m: cpuLoad[1].toFixed(2),
    load15m: cpuLoad[2].toFixed(2),
    cores: os.cpus().length,
  };

  const hasError = Object.values(checks).some((c) => c.status === "error");
  const hasWarning = Object.values(checks).some((c) => c.status === "warning");
  const overallStatus = hasError ? "error" : hasWarning ? "warning" : "ok";

  const totalDuration = Date.now() - startTime;

  logger.info("Deep health check completed", {
    type: "healthcheck",
    status: overallStatus,
    durationMs: totalDuration,
    ledgerBalanced: checks.ledger?.isBalanced,
  });

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      version: "1.0.0",
      environment: process.env.NODE_ENV ?? "development",
      checks,
    },
    hasError ? 503 : 200
  );
});

// ── GET /health/ready
healthcheck.get("/health/ready", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});

// ── GET /health/live
healthcheck.get("/health/live", async (c) => {
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ── GET /metrics (✅ FIXED)
healthcheck.get("/metrics", async (c) => {
  const processMemory = process.memoryUsage();

  const result = await db.execute(
    sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN type = 'payment' THEN 1 ELSE 0 END) as payments,
        SUM(CASE WHEN type = 'refund' THEN 1 ELSE 0 END) as refunds,
        COALESCE(SUM(CASE WHEN status = 'posted' THEN amount ELSE 0 END), 0) as total_volume
      FROM transactions
    `
  );

  const stats =
    (result as unknown as { rows: any[] }).rows?.[0] ??
    (result as unknown as any[])[0] ??
    {};

  return c.json({
    success: true,
    timestamp: new Date().toISOString(),
    metrics: {
      transactions: {
        total: Number(stats.total ?? 0),
        posted: Number(stats.posted ?? 0),
        pending: Number(stats.pending ?? 0),
        failed: Number(stats.failed ?? 0),
        payments: Number(stats.payments ?? 0),
        refunds: Number(stats.refunds ?? 0),
        totalVolume: parseFloat(stats.total_volume ?? "0").toFixed(4),
      },
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        heapUsedMB: Math.round(processMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(processMemory.heapTotal / 1024 / 1024),
        rssMB: Math.round(processMemory.rss / 1024 / 1024),
      },
    },
  });
});

export default healthcheck;
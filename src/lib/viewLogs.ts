import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const readLogs = (filename: string) => {
  const logPath = path.join(process.cwd(), "logs", filename);

  if (!fs.existsSync(logPath)) {
    console.log(`❌ Log file not found: ${logPath}`);
    return [];
  }

  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });
};

const viewLogs = () => {
  console.log("📋 Fintech API Log Viewer\n");
  console.log("═".repeat(50));

  // ── Error logs
  console.log("\n❌ ERROR LOGS (last 10):");
  const errorLogs = readLogs("error.log").slice(-10);

  if (errorLogs.length === 0) {
    console.log("   No errors logged ✅");
  } else {
    errorLogs.forEach((log) => {
      console.log(`\n   [${log.timestamp}] ${log.message}`);
      if (log.errorMessage) console.log(`   Error: ${log.errorMessage}`);
      if (log.traceId) console.log(`   Trace: ${log.traceId}`);
    });
  }

  // ── Combined logs summary
  console.log("\n📊 COMBINED LOG SUMMARY (last 20):");
  const allLogs = readLogs("combined.log").slice(-20);

  const summary = {
    total: allLogs.length,
    byLevel: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    payments: 0,
    errors: 0,
    requests: 0,
  };

  allLogs.forEach((log) => {
    // Count by level
    summary.byLevel[log.level] = (summary.byLevel[log.level] ?? 0) + 1;

    // Count by type
    if (log.type) {
      summary.byType[log.type] = (summary.byType[log.type] ?? 0) + 1;
    }

    if (log.type === "payment") summary.payments++;
    if (log.level === "error") summary.errors++;
    if (log.type === "request") summary.requests++;
  });

  console.log(`\n   Total log entries : ${summary.total}`);
  console.log(`   Requests logged   : ${summary.requests}`);
  console.log(`   Payments logged   : ${summary.payments}`);
  console.log(`   Errors logged     : ${summary.errors}`);

  console.log("\n   By Level:");
  Object.entries(summary.byLevel).forEach(([level, count]) => {
    console.log(`     ${level.padEnd(10)}: ${count}`);
  });

  console.log("\n   By Type:");
  Object.entries(summary.byType).forEach(([type, count]) => {
    console.log(`     ${type.padEnd(12)}: ${count}`);
  });

  // ── Recent payment logs
  const paymentLogs = allLogs.filter((l) => l.type === "payment").slice(-5);
  if (paymentLogs.length > 0) {
    console.log("\n💳 RECENT PAYMENT EVENTS:");
    paymentLogs.forEach((log) => {
      console.log(
        `   [${log.timestamp?.substring(11, 19)}] ${log.message} — $${log.amount} ${log.currency} — ${log.status}`
      );
    });
  }

  console.log("\n" + "═".repeat(50));
  console.log("✅ Log viewer complete");
};

viewLogs();
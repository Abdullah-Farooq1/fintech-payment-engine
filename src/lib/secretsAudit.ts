import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ── Patterns that should never appear in code
const SECRET_PATTERNS = [
  { name: "AWS Access Key",      pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS Secret Key",      pattern: /[0-9a-zA-Z/+]{40}/g },
  { name: "Private Key",         pattern: /-----BEGIN\s+PRIVATE KEY-----/g },
  { name: "Password in code",    pattern: /password\s*=\s*["'][^"']{8,}["']/gi },
  { name: "Database URL in code",pattern: /postgresql:\/\/[^:]+:[^@]+@/g },
  { name: "JWT Secret in code",  pattern: /jwt.?secret\s*=\s*["'][^"']{10,}["']/gi },
];

// ── Files to check
const FILES_TO_CHECK = [
  "src/server.ts",
  "src/db/index.ts",
  "src/lib/paymentService.ts",
  "drizzle.config.ts",
];

// ── Files that MUST exist
const REQUIRED_SECURITY_FILES = [
  ".gitignore",
  ".env",
];

// ── Content that must be in .gitignore
const REQUIRED_GITIGNORE_ENTRIES = [
  ".env",
  "node_modules",
  "logs/",
];

export const runSecretsAudit = () => {
  console.log("\n🔐 Running Security & Secrets Audit\n");
  console.log("═".repeat(50));

  let totalIssues = 0;
  let totalChecks = 0;

  // ── Check 1: Required files exist
  console.log("\n📁 CHECK 1 — Required Files");
  REQUIRED_SECURITY_FILES.forEach((file) => {
    totalChecks++;
    const exists = fs.existsSync(path.join(process.cwd(), file));
    if (exists) {
      console.log(`   ✅ ${file} exists`);
    } else {
      console.log(`   ❌ ${file} MISSING`);
      totalIssues++;
    }
  });

  // ── Check 2: .gitignore has required entries
  console.log("\n📋 CHECK 2 — .gitignore Entries");
  try {
    const gitignore = fs.readFileSync(
      path.join(process.cwd(), ".gitignore"),
      "utf-8"
    );
    REQUIRED_GITIGNORE_ENTRIES.forEach((entry) => {
      totalChecks++;
      if (gitignore.includes(entry)) {
        console.log(`   ✅ .gitignore contains: ${entry}`);
      } else {
        console.log(`   ❌ .gitignore MISSING: ${entry}`);
        totalIssues++;
      }
    });
  } catch {
    console.log("   ❌ Could not read .gitignore");
    totalIssues++;
  }

  // ── Check 3: No hardcoded secrets in source files
  console.log("\n🔍 CHECK 3 — Hardcoded Secrets Scan");
  FILES_TO_CHECK.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf-8");
    let fileHasIssues = false;

    SECRET_PATTERNS.forEach(({ name, pattern }) => {
      totalChecks++;
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        console.log(`   ❌ ${file}: Possible ${name} detected`);
        totalIssues++;
        fileHasIssues = true;
      }
    });

    if (!fileHasIssues) {
      console.log(`   ✅ ${file}: Clean`);
    }
  });

  // ── Check 4: Environment variables set
  console.log("\n🌍 CHECK 4 — Required Environment Variables");
  const requiredEnvVars = [
    "DATABASE_URL",
    "PORT",
  ];

  requiredEnvVars.forEach((envVar) => {
    totalChecks++;
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar} is set`);
    } else {
      console.log(`   ⚠️  ${envVar} is not set`);
      totalIssues++;
    }
  });

  // ── Check 5: JWT secret strength
  console.log("\n🔑 CHECK 5 — JWT Secret Strength");
  totalChecks++;
  const jwtSecret = process.env.JWT_SECRET ?? "";
  if (jwtSecret.length >= 32) {
    console.log(`   ✅ JWT_SECRET is strong (${jwtSecret.length} chars)`);
  } else if (jwtSecret.length > 0) {
    console.log(`   ⚠️  JWT_SECRET is weak (${jwtSecret.length} chars — need 32+)`);
    totalIssues++;
  } else {
    console.log(`   ⚠️  JWT_SECRET is not set`);
    totalIssues++;
  }

  // ── Summary
  console.log("\n" + "═".repeat(50));
  console.log(`📊 AUDIT SUMMARY:`);
  console.log(`   Total Checks : ${totalChecks}`);
  console.log(`   Issues Found : ${totalIssues}`);
  console.log(`   Status       : ${totalIssues === 0 ? "✅ CLEAN" : `⚠️  ${totalIssues} ISSUE(S) FOUND`}`);

  if (totalIssues === 0) {
    console.log("\n🎉 Security audit passed — no issues found");
  } else {
    console.log("\n⚠️  Review and fix the issues above before deploying");
  }

  console.log("═".repeat(50));

  logger.info("Security audit completed", {
    type: "security",
    totalChecks,
    totalIssues,
    passed: totalIssues === 0,
  });
};

runSecretsAudit();
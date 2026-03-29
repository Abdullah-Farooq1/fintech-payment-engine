import { withRetry, isRetryableError } from "./retry";
import * as dotenv from "dotenv";

dotenv.config();

const runRetryTests = async () => {
  console.log("🔄 Testing Retry Logic & Timeout Handling\n");
  console.log("═".repeat(50));

  // ── Test 1: Successful on first attempt
  console.log("\n🧪 TEST 1 — Success On First Attempt");
  let attempts1 = 0;

  const result1 = await withRetry(async () => {
    attempts1++;
    return "success";
  });

  console.log(`   Attempts : ${attempts1} (expected 1)`);
  console.log(`   Result   : ${result1}`);
  console.log(
    attempts1 === 1 && result1 === "success"
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 2: Succeeds on 3rd attempt
  console.log("\n🧪 TEST 2 — Succeeds On 3rd Attempt");
  let attempts2 = 0;

  const result2 = await withRetry(
    async () => {
      attempts2++;
      if (attempts2 < 3) {
        throw new Error("deadlock detected");
      }
      return "recovered";
    },
    { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 }
  );

  console.log(`   Attempts : ${attempts2} (expected 3)`);
  console.log(`   Result   : ${result2}`);
  console.log(
    attempts2 === 3 && result2 === "recovered"
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 3: Non-retryable error throws immediately
  console.log("\n🧪 TEST 3 — Non-Retryable Error Throws Immediately");
  let attempts3 = 0;

  try {
    await withRetry(
      async () => {
        attempts3++;
        throw new Error("Insufficient funds");
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 }
    );
  } catch (err: any) {
    console.log(`   Attempts : ${attempts3} (expected 1)`);
    console.log(`   Error    : ${err.message}`);
    console.log(
      attempts3 === 1
        ? "   ✅ PASSED — Did not retry business error"
        : "   ❌ FAILED — Retried when it shouldn't"
    );
  }

  // ── Test 4: Exhausts all retries and throws
  console.log("\n🧪 TEST 4 — Exhausts All Retries");
  let attempts4 = 0;

  try {
    await withRetry(
      async () => {
        attempts4++;
        throw new Error("connection terminated");
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 }
    );
  } catch (err: any) {
    console.log(`   Attempts : ${attempts4} (expected 3)`);
    console.log(`   Error    : ${err.message}`);
    console.log(
      attempts4 === 3
        ? "   ✅ PASSED — Exhausted all retries"
        : "   ❌ FAILED"
    );
  }

  // ── Test 5: isRetryableError correctly classifies errors
  console.log("\n🧪 TEST 5 — Error Classification");

  const retryableErrors = [
    "deadlock detected",
    "could not serialize access",
    "connection terminated unexpectedly",
    "ECONNRESET",
    "ETIMEDOUT",
  ];

  const nonRetryableErrors = [
    "Insufficient funds",
    "Account not found",
    "Currency mismatch",
    "Validation failed",
  ];

  let classificationPassed = true;

  retryableErrors.forEach((msg) => {
    const result = isRetryableError(new Error(msg));
    if (!result) {
      console.log(`   ❌ Should be retryable: ${msg}`);
      classificationPassed = false;
    }
  });

  nonRetryableErrors.forEach((msg) => {
    const result = isRetryableError(new Error(msg));
    if (result) {
      console.log(`   ❌ Should NOT be retryable: ${msg}`);
      classificationPassed = false;
    }
  });

  console.log(
    classificationPassed
      ? "   ✅ PASSED — All errors classified correctly"
      : "   ❌ FAILED — Some errors misclassified"
  );

  console.log("\n" + "═".repeat(50));
  console.log("✅ Day 4 — Retry & Timeout Tests Complete");
  process.exit(0);
};

runRetryTests().catch((err) => {
  console.error("❌ Retry test failed:", err);
  process.exit(1);
});
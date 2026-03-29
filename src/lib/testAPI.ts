import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "http://localhost:3000";

const CUSTOMER_A_ID = "eb3465fd-5ae7-48d4-bba3-5a62dd4f6ebd";
const SYSTEM_CASH_ID = "e871bc23-ae2a-4dc9-a4e7-d2a8565c5b1b";

const log = (label: string, data: any) => {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📌 ${label}`);
  console.log(JSON.stringify(data, null, 2));
};

const post = async (path: string, body: any): Promise<any> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
};

const get = async (path: string): Promise<any> => {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json() as Promise<any>;
};

const runTests = async () => {
  console.log("🧪 Phase 2 — Full API Test Suite");
  console.log("═".repeat(50));

  // ── Test 1: Health check
  const health: any = await get("/health");
  log("TEST 1 — Health Check", health);
  console.log(health.status === "ok" ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 2: Get all accounts
  const accounts: any = await get("/accounts");
  log("TEST 2 — Get All Accounts", {
    count: accounts.count,
    accounts: accounts.data?.map((a: any) => ({
      name: a.name,
      balance: a.balance,
    })),
  });
  console.log(accounts.success ? "   ✅ PASSED" : "   ❌ FAILED");

  // ── Test 3: Create valid payment
  const payment1: any = await post("/payment-intent", {
    amount: 100,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "API test payment 1",
    idempotencyKey: `api_test_${Date.now()}_1`,
  });
  log("TEST 3 — Create Valid Payment", {
    status: payment1.data?.status,
    amount: payment1.data?.amount,
    balanceBefore: payment1.data?.sourceAccount?.balanceBefore,
    balanceAfter: payment1.data?.sourceAccount?.balanceAfter,
    isBalanced: payment1.data?.ledger?.isBalanced,
  });
  console.log(
    payment1.success && payment1.data?.status === "posted"
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 4: Duplicate idempotency key
  const dupKey = `dup_test_${Date.now()}`;
  await post("/payment-intent", {
    amount: 50,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Duplicate test",
    idempotencyKey: dupKey,
  });
  const duplicate: any = await post("/payment-intent", {
    amount: 50,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Duplicate test",
    idempotencyKey: dupKey,
  });
  log("TEST 4 — Duplicate Idempotency Key", {
    duplicate: duplicate.duplicate,
    message: duplicate.message,
  });
  console.log(
    duplicate.duplicate === true ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Test 5: Insufficient funds
  const insufficient: any = await post("/payment-intent", {
    amount: 999999,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Insufficient funds test",
    idempotencyKey: `insufficient_${Date.now()}`,
  });
  log("TEST 5 — Insufficient Funds", {
    success: insufficient.success,
    error: insufficient.error,
  });
  console.log(
    insufficient.success === false &&
      insufficient.error?.includes("Insufficient")
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 6: Negative amount
  const negative: any = await post("/payment-intent", {
    amount: -100,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    idempotencyKey: `negative_${Date.now()}`,
  });
  log("TEST 6 — Negative Amount", {
    success: negative.success,
    error: negative.error,
    details: negative.details,
  });
  console.log(
    negative.success === false ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Test 7: Invalid UUID
  const invalidUUID: any = await post("/payment-intent", {
    amount: 100,
    currency: "USD",
    sourceAccountId: "not-a-uuid",
    destinationAccountId: SYSTEM_CASH_ID,
    idempotencyKey: `invalid_uuid_${Date.now()}`,
  });
  log("TEST 7 — Invalid UUID", {
    success: invalidUUID.success,
    error: invalidUUID.error,
    details: invalidUUID.details,
  });
  console.log(
    invalidUUID.success === false ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Test 8: Get transaction by ID
  const payment2: any = await post("/payment-intent", {
    amount: 25,
    currency: "USD",
    sourceAccountId: CUSTOMER_A_ID,
    destinationAccountId: SYSTEM_CASH_ID,
    description: "Transaction detail test",
    idempotencyKey: `txn_detail_${Date.now()}`,
  });
  const txnDetail: any = await get(
    `/transactions/${payment2.data?.transactionId}`
  );
  log("TEST 8 — Get Transaction Detail", {
    id: txnDetail.data?.transaction?.id,
    status: txnDetail.data?.transaction?.status,
    entriesCount: txnDetail.data?.entries?.length,
    isBalanced: txnDetail.data?.verification?.isBalanced,
  });
  console.log(
    txnDetail.success &&
      txnDetail.data?.entries?.length === 2 &&
      txnDetail.data?.verification?.isBalanced
      ? "   ✅ PASSED"
      : "   ❌ FAILED"
  );

  // ── Test 9: Get single account
  const singleAccount: any = await get(`/accounts/${CUSTOMER_A_ID}`);
  log("TEST 9 — Get Single Account", {
    name: singleAccount.data?.name,
    balance: singleAccount.data?.balance,
  });
  console.log(
    singleAccount.success ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Test 10: Ledger balance verification
  const ledger: any = await get("/ledger/balance");
  log("TEST 10 — Ledger Balance Verification", {
    totalDebits: ledger.data?.totalDebits,
    totalCredits: ledger.data?.totalCredits,
    difference: ledger.data?.difference,
    isBalanced: ledger.data?.isBalanced,
    status: ledger.data?.status,
  });
  console.log(
    ledger.data?.isBalanced ? "   ✅ PASSED" : "   ❌ FAILED"
  );

  // ── Final Summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 FINAL ACCOUNT BALANCES:");
  const finalAccounts: any = await get("/accounts");
  finalAccounts.data?.forEach((a: any) => {
    console.log(`   ${a.name.padEnd(25)} | $${a.balance}`);
  });

  console.log("\n✅ Phase 2 — Day 5 Complete!");
  console.log("✅ Phase 2 — FULLY COMPLETE!");
  console.log("═".repeat(50));
  process.exit(0);
};

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
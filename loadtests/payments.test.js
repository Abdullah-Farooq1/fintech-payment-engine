import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics
const errorRate = new Rate("error_rate");
const paymentDuration = new Trend("payment_duration");
const duplicateCount = new Counter("duplicate_payments");
const successCount = new Counter("successful_payments");

// ── Test configuration
export const options = {
  stages: [
    { duration: "10s", target: 5  },  // Warm up
    { duration: "20s", target: 20 },  // Normal load
    { duration: "20s", target: 50 },  // Peak load
    { duration: "10s", target: 0  },  // Cool down
  ],
  thresholds: {
    http_req_duration:  ["p(95)<2000"], // 95% under 2 seconds
    error_rate:         ["rate<0.05"],  // Less than 5% errors
    payment_duration:   ["p(99)<3000"], // 99% under 3 seconds
  },
};

const BASE_URL = "http://localhost:3000";

// Account IDs from your seeded data
const SOURCE_ACCOUNT = "eb3465fd-5ae7-48d4-bba3-5a62dd4f6ebd";
const DEST_ACCOUNT   = "e871bc23-ae2a-4dc9-a4e7-d2a8565c5b1b";

export default function () {
  // ── Generate unique idempotency key per request
  const idempotencyKey = `load_test_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  const payload = JSON.stringify({
    amount: 0.01,
    currency: "USD",
    sourceAccountId: SOURCE_ACCOUNT,
    destinationAccountId: DEST_ACCOUNT,
    description: "Load test payment",
    idempotencyKey,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    timeout: "10s",
  };

  const res = http.post(
    `${BASE_URL}/payment-intent`,
    payload,
    params
  );

  const success = check(res, {
    "payment status 200/201": (r) => r.status === 200 || r.status === 201,
    "payment has transactionId": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data?.transactionId !== undefined || body.duplicate === true;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const body = JSON.parse(res.body);
      if (body.duplicate) {
        duplicateCount.add(1);
      } else if (body.success) {
        successCount.add(1);
      }
    } catch {}
  }

  errorRate.add(!success);
  paymentDuration.add(res.timings.duration);

  sleep(0.5);
}
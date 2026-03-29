import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("error_rate");

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "30s", target: 20 },
    { duration: "10s", target: 0  },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    error_rate:        ["rate<0.01"],
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  // ── Check ledger balance under load
  const ledgerRes = http.get(`${BASE_URL}/ledger/balance`);

  const ledgerOk = check(ledgerRes, {
    "ledger status 200":    (r) => r.status === 200,
    "ledger is balanced":   (r) => {
      try {
        return JSON.parse(r.body).data?.isBalanced === true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ledgerOk);

  // ── Check metrics endpoint
  const metricsRes = http.get(`${BASE_URL}/metrics`);

  check(metricsRes, {
    "metrics status 200": (r) => r.status === 200,
    "metrics has data":   (r) => {
      try {
        return JSON.parse(r.body).metrics !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(0.5);
}
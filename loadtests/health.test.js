import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics
const errorRate = new Rate("error_rate");
const responseTime = new Trend("response_time");

// ── Test configuration
export const options = {
  stages: [
    { duration: "10s", target: 10  },  // Ramp up to 10 users
    { duration: "20s", target: 50  },  // Ramp up to 50 users
    { duration: "20s", target: 100 },  // Ramp up to 100 users
    { duration: "10s", target: 0   },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests under 500ms
    error_rate:        ["rate<0.01"],  // Less than 1% error rate
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  // ── Test health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);

  check(healthRes, {
    "health status 200":    (r) => r.status === 200,
    "health status is ok":  (r) => JSON.parse(r.body).status === "ok",
    "response time < 200ms":(r) => r.timings.duration < 200,
  });

  errorRate.add(healthRes.status !== 200);
  responseTime.add(healthRes.timings.duration);

  // ── Test accounts endpoint
  const accountsRes = http.get(`${BASE_URL}/accounts`);

  check(accountsRes, {
    "accounts status 200":   (r) => r.status === 200,
    "accounts has data":     (r) => JSON.parse(r.body).count > 0,
  });

  errorRate.add(accountsRes.status !== 200);

  sleep(0.1);
}
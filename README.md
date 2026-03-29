# Fintech Payment Engine

A production-grade, distributed payment processing system built with modern technologies. Implements double-entry bookkeeping, distributed workflows, API gateway pattern, and a full admin portal.

---

## Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Portal (React)                      │
│              http://localhost:5174                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Go API Gateway                               │
│         JWT Auth │ Rate Limiting │ Circuit Breaker           │
│              http://localhost:8080                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Hono.js Payment API                             │
│    Double-Entry Ledger │ Idempotency │ Row Locking           │
│              http://localhost:3000                           │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼───────────────────────┐
│   PostgreSQL DB      │   │      Temporal.io                  │
│  Double-Entry Ledger │   │  Refund Workflows │ Saga Pattern  │
└─────────────────────┘   └───────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | Hono.js + TypeScript | Core payment REST API |
| **Gateway** | Go + Gin | JWT auth, rate limiting, circuit breaker |
| **Database** | PostgreSQL + Drizzle ORM | Double-entry ledger |
| **Workflows** | Temporal.io | Distributed refund workflows |
| **Frontend** | React + Vite + TailwindCSS | Admin portal |
| **Cache** | Redis | Rate limiting, session storage |
| **Logging** | Winston | Structured JSON logging |
| **Testing** | k6 | Load testing |

---

## Core Features

### Double-Entry Ledger
- Every payment creates exactly 2 ledger entries — one debit, one credit
- Debit sum always equals credit sum — mathematically guaranteed
- `Numeric(20,4)` precision — no floating point errors on money
- Check constraints prevent negative balances on asset accounts

### Payment Reliability
- **Idempotency keys** — same request never creates two transactions
- **SELECT FOR UPDATE** — row-level locking prevents race conditions
- **DB transactions** — all 6 writes succeed or all fail atomically
- **Exponential backoff** — transient DB errors auto-retry

### Distributed Workflows (Temporal)
- **Refund workflow** — 4-step durable process with timeout handling
- **Saga pattern** — compensation logic unlocks funds on failure
- **Activity idempotency** — worker restarts never cause double refunds

### API Gateway (Go)
- **JWT authentication** — every request validated before hitting API
- **Redis rate limiting** — 100 req/min global, 10 payments/min per user
- **Circuit breaker** — opens after 50% failure rate, auto-recovers
- **Graceful shutdown** — SIGTERM handled, in-flight requests complete
- **OpenTelemetry** — distributed tracing across gateway and API

### Admin Portal (React)
- Real-time account balances and ledger status
- Transaction explorer with full double-entry detail modal
- Payment form with idempotency key management
- Refund UI with full and partial refund support
- JWT login with role-based access

---

## Project Structure
```
fintech-ledger/
├── src/
│   ├── db/                    # Database connection
│   ├── schema/                # Drizzle ORM schemas
│   │   ├── accounts.ts        # Account types and constraints
│   │   ├── transactions.ts    # Transaction records
│   │   └── entries.ts         # Double-entry ledger entries
│   ├── lib/
│   │   ├── paymentService.ts  # Core payment logic with locking
│   │   ├── ledger.ts          # Ledger query utilities
│   │   ├── retry.ts           # Exponential backoff retry
│   │   ├── logger.ts          # Winston structured logging
│   │   └── validators.ts      # Zod input validation
│   ├── routes/
│   │   ├── payments.ts        # POST /payment-intent
│   │   ├── accounts.ts        # GET /accounts
│   │   ├── transactions.ts    # GET /transactions
│   │   └── healthcheck.ts     # Health and metrics endpoints
│   ├── middleware/
│   │   ├── idempotency.ts     # Duplicate request detection
│   │   ├── errorHandler.ts    # Consistent error formatting
│   │   ├── security.ts        # Security headers and audit
│   │   └── winstonLogger.ts   # Request logging middleware
│   └── temporal/
│       ├── workflows/
│       │   ├── refundWorkflow.ts      # Basic refund workflow
│       │   ├── sagaWorkflow.ts        # Saga with compensation
│       │   └── idempotentRefundWorkflow.ts
│       └── activities/
│           ├── refundActivities.ts    # Ledger and provider calls
│           └── sagaActivities.ts      # Reservation activities
├── gateway/                   # Go API Gateway
│   ├── cmd/main.go            # Server entry point
│   └── internal/
│       ├── middleware/        # JWT, rate limit, circuit breaker
│       ├── handlers/          # Health, auth, proxy handlers
│       └── config/            # Config, Redis, tracer, logger
├── admin-portal/              # React Admin UI
│   └── src/
│       ├── pages/             # Dashboard, Accounts, Transactions, Payments, Refunds, Ledger
│       ├── components/        # Sidebar, Header, StatsCard, TransactionModal
│       └── lib/               # API client, auth context
└── loadtests/                 # k6 load test scripts
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Go 1.22+
- PostgreSQL 14+
- Redis
- Temporal CLI

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/fintech-payment-engine.git
cd fintech-payment-engine
```

### 2. Setup environment variables
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/fintech_ledger
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
PORT=3000
GATEWAY_PORT=8080
HONO_URL=http://localhost:3000
JWT_SECRET=your-super-secret-key-minimum-32-characters
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
```

### 3. Install dependencies and setup database
```bash
npm install
npm run push
npm run seed:accounts
npm run seed:transactions
```

### 4. Start all services

**Terminal 1 — Temporal dev server:**
```bash
temporal server start-dev --port 7233 --ui-port 8233
```

**Terminal 2 — Redis:**
```bash
redis-server
```

**Terminal 3 — Hono.js API:**
```bash
npm run server
```

**Terminal 4 — Go Gateway:**
```bash
cd gateway && go run cmd/main.go
```

**Terminal 5 — Admin Portal:**
```bash
cd admin-portal && npm run dev
```

---

## API Reference

### Core Endpoints (Hono API — port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/health/deep` | Full system health with metrics |
| `GET` | `/health/live` | Liveness check |
| `GET` | `/health/ready` | Readiness check |
| `GET` | `/metrics` | Transaction counts and system metrics |
| `GET` | `/accounts` | List all accounts with balances |
| `GET` | `/accounts/:id` | Get single account |
| `GET` | `/transactions` | List all transactions |
| `GET` | `/transactions/:id` | Get transaction with ledger entries |
| `POST` | `/payment-intent` | Create and post a payment |
| `GET` | `/ledger/balance` | Verify ledger is balanced |

### Gateway Endpoints (Go — port 8080)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/gateway/health` | None | Gateway health |
| `GET` | `/gateway/circuit` | None | Circuit breaker status |
| `POST` | `/gateway/token` | None | Generate JWT token |
| `GET` | `/api/me` | JWT | Current user info |
| `POST` | `/api/payment-intent` | JWT | Create payment via gateway |
| `GET` | `/api/admin/accounts` | JWT + Admin | List accounts |
| `GET` | `/api/admin/ledger/balance` | JWT + Admin | Ledger status |

### Payment Intent Request
```json
POST /payment-intent
{
  "amount": 100.00,
  "currency": "USD",
  "sourceAccountId": "uuid",
  "destinationAccountId": "uuid",
  "description": "Payment description",
  "idempotencyKey": "unique-key-per-request",
  "metadata": {}
}
```

### Payment Intent Response
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "traceId": "trace_xxx",
    "status": "posted",
    "amount": "100.0000",
    "currency": "USD",
    "sourceAccount": {
      "balanceBefore": "5000.0000",
      "balanceAfter": "4900.0000"
    },
    "destinationAccount": {
      "balanceBefore": "1000.0000",
      "balanceAfter": "1100.0000"
    },
    "ledger": {
      "isBalanced": true
    }
  }
}
```

---

## Double-Entry Bookkeeping

Every payment creates exactly two ledger entries:
```
Payment of $100 from Customer A → System Cash

DEBIT   Customer A Wallet     $100.00  (money leaving)
CREDIT  System Cash Account   $100.00  (money arriving)

Sum: $100 - $100 = $0.00 ✅ Always balanced
```

The ledger can never be corrupted because:
1. Both entries are written inside a single DB transaction
2. If either write fails, both are rolled back
3. The balance check runs inside the same locked transaction
4. Idempotency keys prevent any transaction from being written twice

---

## Load Test Results

Run with k6 against local environment:

| Test | VUs | p95 Latency | Error Rate |
|------|-----|-------------|------------|
| Health check | 100 | < 50ms | 0% |
| Accounts fetch | 100 | < 100ms | 0% |
| Payment intent | 50 | < 800ms | < 1% |
| Ledger balance | 20 | < 200ms | 0% |

Ledger remained balanced throughout all load tests.

---

## Security

- JWT authentication on all protected routes
- Redis-based rate limiting (100 req/min global, 10 payments/min)
- Circuit breaker prevents cascade failures
- Row-level locking prevents race conditions
- Input validation with Zod on all endpoints
- Security headers (X-Frame-Options, CSP, HSTS)
- Request size limiting (500KB max)
- Secrets audit script included

---

## Phase Completion

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Double-Entry Ledger (PostgreSQL + Drizzle) | ✅ Complete |
| 2 | Core Payment API (Hono.js) | ✅ Complete |
| 3 | Reliability Layer (Locking + Idempotency) | ✅ Complete |
| 4 | Temporal Workflows (Refund + Saga) | ✅ Complete |
| 5 | API Gateway (Go + Gin) | ✅ Complete |
| 6 | Admin Portal (React + TailwindCSS) | ✅ Complete |
| 7 | Infrastructure (Render + Vercel) | ⏳ Pending |
| 8 | Observability & Hardening | ✅ Complete |

---

## Author

**Abdullah**
BS Computer Science — University of Management and Technology, Lahore
Full Stack Developer & AI/ML Engineer

---

## License

MIT
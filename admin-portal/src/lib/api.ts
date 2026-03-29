import axios from "axios";

const API_BASE = "http://localhost:3000";
const GATEWAY_BASE = "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const gateway = axios.create({
  baseURL: GATEWAY_BASE,
  headers: { "Content-Type": "application/json" },
});

gateway.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Accounts
export const fetchAccounts = () =>
  api.get("/accounts").then((r) => r.data);

export const fetchAccount = (id: string) =>
  api.get(`/accounts/${id}`).then((r) => r.data);

// ── Transactions
export const fetchTransactions = () =>
  api.get("/transactions").then((r) => r.data);

export const fetchTransaction = (id: string) =>
  api.get(`/transactions/${id}`).then((r) => r.data);

// ── Ledger
export const fetchLedgerBalance = () =>
  api.get("/ledger/balance").then((r) => r.data);

// ── Payments
export const createPayment = (data: {
  amount: number;
  currency: string;
  sourceAccountId: string;
  destinationAccountId: string;
  description?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) => api.post("/payment-intent", data).then((r) => r.data);
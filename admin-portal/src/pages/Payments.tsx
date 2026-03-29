import { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Header } from "../components/Header";
import { fetchAccounts, createPayment } from "../lib/api";

const generateIdempotencyKey = () => {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const Payments = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    sourceAccountId: "",
    destinationAccountId: "",
    description: "",
    idempotencyKey: generateIdempotencyKey(),
  });

  useEffect(() => {
    fetchAccounts()
      .then((res) => setAccounts(res.data ?? []))
      .catch(() => setError("Failed to load accounts"))
      .finally(() => setLoadingAccounts(false));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const regenerateKey = () => {
    setForm((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
  };

  const copyKey = () => {
    navigator.clipboard.writeText(form.idempotencyKey);
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    if (!form.amount || !form.sourceAccountId || !form.destinationAccountId) {
      setError("Amount, source account and destination account are required");
      return;
    }

    if (form.sourceAccountId === form.destinationAccountId) {
      setError("Source and destination accounts must be different");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    try {
      setLoading(true);
      const res = await createPayment({
        amount,
        currency: form.currency as any,
        sourceAccountId: form.sourceAccountId,
        destinationAccountId: form.destinationAccountId,
        description: form.description || undefined,
        idempotencyKey: form.idempotencyKey,
        metadata: { source: "admin-portal" },
      });
      setResult(res);

      // Regenerate key for next payment
      setForm((prev) => ({
        ...prev,
        amount: "",
        description: "",
        idempotencyKey: generateIdempotencyKey(),
      }));
    } catch (err: any) {
      setError(
        err.response?.data?.error ?? "Payment failed. Check console for details."
      );
    } finally {
      setLoading(false);
    }
  };

  const sourceAccount = accounts.find((a) => a.id === form.sourceAccountId);
  const destAccount = accounts.find((a) => a.id === form.destinationAccountId);

  return (
    <div>
      <Header
        title="Create Payment"
        subtitle="Submit a new payment intent"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Payment Form */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-400" />
            Payment Intent
          </h3>

          <div className="space-y-4">

            {/* Amount */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
                />
                <select
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
                >
                  {["USD", "EUR", "GBP", "PKR"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source Account */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Source Account <span className="text-red-400">*</span>
              </label>
              {loadingAccounts ? (
                <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  name="sourceAccountId"
                  value={form.sourceAccountId}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
                >
                  <option value="">Select source account...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — ${parseFloat(acc.balance).toFixed(2)} {acc.currency}
                    </option>
                  ))}
                </select>
              )}
              {sourceAccount && (
                <p className="text-green-400 text-xs mt-1">
                  Available: ${parseFloat(sourceAccount.balance).toLocaleString("en-US", {
                    minimumFractionDigits: 4,
                  })}
                </p>
              )}
            </div>

            {/* Destination Account */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Destination Account <span className="text-red-400">*</span>
              </label>
              {loadingAccounts ? (
                <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  name="destinationAccountId"
                  value={form.destinationAccountId}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
                >
                  <option value="">Select destination account...</option>
                  {accounts
                    .filter((a) => a.id !== form.sourceAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — ${parseFloat(acc.balance).toFixed(2)} {acc.currency}
                      </option>
                    ))}
                </select>
              )}
              {destAccount && (
                <p className="text-blue-400 text-xs mt-1">
                  Current balance: ${parseFloat(destAccount.balance).toLocaleString("en-US", {
                    minimumFractionDigits: 4,
                  })}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Payment description..."
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm resize-none"
              />
            </div>

            {/* Idempotency Key */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Idempotency Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="idempotencyKey"
                  value={form.idempotencyKey}
                  onChange={handleChange}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={copyKey}
                  className="btn-secondary p-2.5"
                  title="Copy key"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={regenerateKey}
                  className="btn-secondary p-2.5"
                  title="Regenerate key"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Unique key prevents duplicate payments
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Submit Payment
                </>
              )}
            </button>
          </div>
        </div>

        {/* Result Panel */}
        <div>
          {result ? (
            <div className={`card border-2 ${
              result.success
                ? "border-green-700"
                : "border-red-700"
            }`}>
              <div className="flex items-center gap-3 mb-6">
                {result.success ? (
                  <div className="w-12 h-12 bg-green-900/50 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                )}
                <div>
                  <h4 className="text-white font-bold">
                    {result.success ? "Payment Successful" : "Payment Failed"}
                  </h4>
                  <p className="text-gray-400 text-sm">{result.message}</p>
                </div>
              </div>

              {result.success && result.data && (
                <div className="space-y-4">
                  {/* Transaction ID */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Transaction ID</p>
                    <p className="text-white font-mono text-sm break-all">
                      {result.data.transactionId}
                    </p>
                  </div>

                  {/* Amount & Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Amount</p>
                      <p className="text-green-400 font-mono font-bold">
                        ${parseFloat(result.data.amount).toFixed(4)}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Status</p>
                      <span className="badge-success capitalize">
                        {result.data.status}
                      </span>
                    </div>
                  </div>

                  {/* Balance Changes */}
                  {result.data.sourceAccount && (
                    <div className="space-y-2">
                      <p className="text-gray-400 text-sm font-medium">Balance Changes</p>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-2">
                          {result.data.sourceAccount.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-mono text-sm">
                            ${parseFloat(result.data.sourceAccount.balanceBefore).toFixed(4)}
                          </span>
                          <span className="text-gray-600 text-xs">→</span>
                          <span className="text-red-400 font-mono text-sm font-bold">
                            ${parseFloat(result.data.sourceAccount.balanceAfter).toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-2">
                          {result.data.destinationAccount.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-mono text-sm">
                            ${parseFloat(result.data.destinationAccount.balanceBefore).toFixed(4)}
                          </span>
                          <span className="text-gray-600 text-xs">→</span>
                          <span className="text-green-400 font-mono text-sm font-bold">
                            ${parseFloat(result.data.destinationAccount.balanceAfter).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ledger Verification */}
                  {result.data.ledger && (
                    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <p className="text-green-400 text-sm font-medium">
                        Ledger balanced — double-entry verified
                      </p>
                    </div>
                  )}
                </div>
              )}

              {result.duplicate && (
                <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ Duplicate request detected — returning existing transaction
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="card border border-dashed border-gray-700 flex items-center justify-center h-64">
              <div className="text-center">
                <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  Payment result will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
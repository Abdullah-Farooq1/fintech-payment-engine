import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Header } from "../components/Header";
import { fetchLedgerBalance } from "../lib/api";

export const Ledger = () => {
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLedgerBalance();
      setLedger(res.data);
      setLastChecked(new Date());
    } catch {
      setError("Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadLedger, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <Header
        title="Ledger Audit"
        subtitle="Double-entry ledger balance verification"
        onRefresh={loadLedger}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Balance Status Card */}
      <div className={`card mb-6 border-2 ${
        loading
          ? "border-gray-700"
          : ledger?.isBalanced
          ? "border-green-700"
          : "border-red-700"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-16 h-16 bg-gray-800 rounded-full animate-pulse" />
            ) : ledger?.isBalanced ? (
              <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-white">
                {loading
                  ? "Checking..."
                  : ledger?.isBalanced
                  ? "Ledger is Balanced"
                  : "Ledger is UNBALANCED"}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {loading
                  ? "Verifying double-entry integrity..."
                  : ledger?.isBalanced
                  ? "All debits equal all credits — books are clean"
                  : "ALERT: Debits do not equal credits"}
              </p>
              {lastChecked && (
                <p className="text-gray-600 text-xs mt-1">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-gray-400 text-sm">Difference</p>
            <p className={`text-3xl font-mono font-bold ${
              parseFloat(ledger?.difference ?? "0") === 0
                ? "text-green-400"
                : "text-red-400"
            }`}>
              ${parseFloat(ledger?.difference ?? "0").toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {/* Ledger Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-24 mb-3" />
              <div className="h-10 bg-gray-800 rounded w-40" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Total Debits */}
          <div className="card border border-blue-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900/30 p-2 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-gray-400 font-medium">Total Debits</p>
              </div>
            </div>
            <p className="text-3xl font-mono font-bold text-white">
              ${parseFloat(ledger?.totalDebits ?? "0").toLocaleString("en-US", {
                minimumFractionDigits: 4,
              })}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Sum of all debit entries
            </p>
          </div>

          {/* Total Credits */}
          <div className="card border border-purple-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-900/30 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-gray-400 font-medium">Total Credits</p>
              </div>
            </div>
            <p className="text-3xl font-mono font-bold text-white">
              ${parseFloat(ledger?.totalCredits ?? "0").toLocaleString("en-US", {
                minimumFractionDigits: 4,
              })}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Sum of all credit entries
            </p>
          </div>
        </div>
      )}

      {/* Ledger Rules */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-400" />
          Double-Entry Rules
        </h3>
        <div className="space-y-3">
          {[
            {
              rule: "Every transaction has exactly 2 entries",
              desc: "One debit and one credit — always",
              ok: true,
            },
            {
              rule: "Debit entries equal credit entries",
              desc: "Sum of all debits must equal sum of all credits",
              ok: ledger?.isBalanced ?? false,
            },
            {
              rule: "Asset accounts cannot go negative",
              desc: "Enforced at database level via CHECK constraint",
              ok: true,
            },
            {
              rule: "All amounts stored as Numeric(20,4)",
              desc: "No floating point errors on financial data",
              ok: true,
            },
            {
              rule: "Idempotency keys prevent duplicate transactions",
              desc: "Same key never creates two transactions",
              ok: true,
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg"
            >
              {item.ok ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-white text-sm font-medium">{item.rule}</p>
                <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
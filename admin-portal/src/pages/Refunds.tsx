import { useEffect, useState } from "react";
import {
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader,
  Search,
} from "lucide-react";
import { Header } from "../components/Header";
import { fetchTransactions, createPayment } from "../lib/api";

const generateRefundKey = () =>
  `refund_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const Refunds = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetchTransactions();
      const posted = (res.data ?? []).filter(
        (t: any) => t.status === "posted" && t.type === "payment"
      );
      setTransactions(posted);
      setFiltered(posted);
    } catch {
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (!search) {
      setFiltered(transactions);
      return;
    }
    setFiltered(
      transactions.filter(
        (t) =>
          t.id.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, transactions]);

  const handleRefund = async (txn: any, refundAmount: number) => {
    setProcessing(txn.id);
    setError(null);

    try {
      // For demo purposes refund creates a reverse payment
      // In production this would trigger the Temporal refund workflow
      const res = await createPayment({
        amount: refundAmount,
        currency: txn.currency,
        sourceAccountId: txn.destinationAccountId ?? "",
        destinationAccountId: txn.sourceAccountId ?? "",
        description: `Refund for transaction ${txn.id}`,
        idempotencyKey: generateRefundKey(),
        metadata: {
          type: "refund",
          originalTransactionId: txn.id,
        },
      });

      setResults((prev) => ({ ...prev, [txn.id]: res }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [txn.id]: {
          success: false,
          error: err.response?.data?.error ?? "Refund failed",
        },
      }));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <Header
        title="Refunds"
        subtitle="Process refunds for posted payments"
        onRefresh={loadTransactions}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-300 text-sm font-medium">
            Refund Processing
          </p>
          <p className="text-blue-400/70 text-xs mt-1">
            Only posted payment transactions can be refunded.
            Partial refunds are supported. Full refund returns the complete amount.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction ID or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
          />
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-16 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <RotateCcw className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No refundable transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((txn) => {
            const result = results[txn.id];
            const isProcessing = processing === txn.id;

            return (
              <div
                key={txn.id}
                className={`card border ${
                  result?.success
                    ? "border-green-800/50"
                    : result && !result.success
                    ? "border-red-800/50"
                    : "border-gray-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Transaction Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-white font-mono text-sm font-medium">
                        {txn.id.substring(0, 16)}...
                      </p>
                      <span className="badge-success">posted</span>
                      <span className="badge-info">payment</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">
                      {txn.description ?? "No description"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {new Date(txn.createdAt).toLocaleString()}
                      </span>
                      <span>{txn.currency}</span>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-mono font-bold text-green-400 mb-3">
                      ${parseFloat(txn.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                      })}
                    </p>

                    {result ? (
                      <div className={`flex items-center gap-2 justify-end ${
                        result.success ? "text-green-400" : "text-red-400"
                      }`}>
                        {result.success ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">
                          {result.success ? "Refunded" : result.error}
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        {/* Partial refund */}
                        <button
                          onClick={() =>
                            handleRefund(txn, parseFloat(txn.amount) / 2)
                          }
                          disabled={isProcessing}
                          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          50% Refund
                        </button>

                        {/* Full refund */}
                        <button
                          onClick={() =>
                            handleRefund(txn, parseFloat(txn.amount))
                          }
                          disabled={isProcessing}
                          className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Full Refund
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Refund Result */}
                {result?.success && result.data && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Refund Txn ID</p>
                        <p className="text-white font-mono text-xs break-all">
                          {result.data.transactionId?.substring(0, 16)}...
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Amount Refunded</p>
                        <p className="text-green-400 font-mono font-bold text-sm">
                          ${parseFloat(result.data.amount).toFixed(4)}
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Status</p>
                        <span className="badge-success">
                          {result.data.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
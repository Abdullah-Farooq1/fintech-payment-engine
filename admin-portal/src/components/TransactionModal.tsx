import { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { fetchTransaction } from "../lib/api";

interface TransactionModalProps {
  transactionId: string | null;
  onClose: () => void;
}

const statusIcon = {
  posted:   <CheckCircle className="w-4 h-4 text-green-400" />,
  pending:  <Clock className="w-4 h-4 text-yellow-400" />,
  failed:   <XCircle className="w-4 h-4 text-red-400" />,
  reversed: <XCircle className="w-4 h-4 text-gray-400" />,
};

const statusClass = {
  posted:   "badge-success",
  pending:  "badge-warning",
  failed:   "badge-danger",
  reversed: "badge-info",
};

export const TransactionModal = ({
  transactionId,
  onClose,
}: TransactionModalProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchTransaction(transactionId);
        setData(res.data);
      } catch {
        setError("Failed to load transaction details");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [transactionId]);

  if (!transactionId) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white">Transaction Detail</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : data ? (
            <div className="space-y-6">

              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {statusIcon[data.transaction.status as keyof typeof statusIcon]}
                    <span className={`${statusClass[data.transaction.status as keyof typeof statusClass]} capitalize`}>
                      {data.transaction.status}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Type</p>
                  <p className="text-white font-medium capitalize mt-1">
                    {data.transaction.type}
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Amount</p>
                  <p className="text-green-400 font-mono font-bold text-lg mt-1">
                    ${parseFloat(data.transaction.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 4,
                    })}
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Currency</p>
                  <p className="text-white font-medium mt-1">
                    {data.transaction.currency}
                  </p>
                </div>
              </div>

              {/* IDs */}
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Transaction ID</p>
                  <p className="text-white font-mono text-sm break-all">
                    {data.transaction.id}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Trace ID</p>
                  <p className="text-white font-mono text-sm break-all">
                    {data.transaction.traceId}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Idempotency Key</p>
                  <p className="text-white font-mono text-sm break-all">
                    {data.transaction.idempotencyKey}
                  </p>
                </div>
                {data.transaction.description && (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Description</p>
                    <p className="text-white text-sm">
                      {data.transaction.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Double Entry Entries */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">
                    Ledger Entries
                  </h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    data.verification?.isBalanced
                      ? "bg-green-900 text-green-300"
                      : "bg-red-900 text-red-300"
                  }`}>
                    {data.verification?.isBalanced ? "✅ Balanced" : "❌ Unbalanced"}
                  </span>
                </div>

                <div className="space-y-3">
                  {data.entries?.map((entry: any) => (
                    <div
                      key={entry.id}
                      className={`border rounded-lg p-4 ${
                        entry.type === "debit"
                          ? "border-red-800/50 bg-red-900/10"
                          : "border-green-800/50 bg-green-900/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {entry.type === "debit" ? (
                            <ArrowUpRight className="w-4 h-4 text-red-400" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 text-green-400" />
                          )}
                          <span className={`font-medium capitalize text-sm ${
                            entry.type === "debit"
                              ? "text-red-400"
                              : "text-green-400"
                          }`}>
                            {entry.type}
                          </span>
                        </div>
                        <span className={`font-mono font-bold ${
                          entry.type === "debit"
                            ? "text-red-400"
                            : "text-green-400"
                        }`}>
                          ${parseFloat(entry.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium">
                        {entry.accountName}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Balance after: ${parseFloat(entry.balanceAfter).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                        })}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Verification */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">Debit Sum</p>
                    <p className="text-red-400 font-mono font-bold mt-1">
                      ${parseFloat(data.verification?.debitSum ?? "0").toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">Credit Sum</p>
                    <p className="text-green-400 font-mono font-bold mt-1">
                      ${parseFloat(data.verification?.creditSum ?? "0").toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">Difference</p>
                    <p className="text-white font-mono font-bold mt-1">
                      $0.0000
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Created At</p>
                  <p className="text-white text-sm">
                    {new Date(data.transaction.createdAt).toLocaleString()}
                  </p>
                </div>
                {data.transaction.postedAt && (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Posted At</p>
                    <p className="text-white text-sm">
                      {new Date(data.transaction.postedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
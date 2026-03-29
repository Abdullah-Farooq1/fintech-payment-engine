import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Header } from "../components/Header";
import { TransactionModal } from "../components/TransactionModal";
import { fetchTransactions } from "../lib/api";

const statusConfig: Record<string, { label: string; class: string; icon: JSX.Element }> = {
  posted:   { label: "Posted",   class: "badge-success", icon: <CheckCircle className="w-3 h-3" /> },
  pending:  { label: "Pending",  class: "badge-warning", icon: <Clock className="w-3 h-3" /> },
  failed:   { label: "Failed",   class: "badge-danger",  icon: <XCircle className="w-3 h-3" /> },
  reversed: { label: "Reversed", class: "badge-info",    icon: <XCircle className="w-3 h-3" /> },
};

const typeConfig: Record<string, string> = {
  payment:    "badge-info",
  refund:     "badge-warning",
  transfer:   "badge-success",
  fee:        "badge-danger",
  adjustment: "badge-info",
};

export const Transactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTransactions();
      setTransactions(res.data ?? []);
      setFiltered(res.data ?? []);
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
    let result = transactions;

    if (search) {
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()) ||
          t.idempotencyKey?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (selectedStatus !== "all") {
      result = result.filter((t) => t.status === selectedStatus);
    }

    if (selectedType !== "all") {
      result = result.filter((t) => t.type === selectedType);
    }

    setFiltered(result);
  }, [search, selectedStatus, selectedType, transactions]);

  const totalAmount = transactions
    .filter((t) => t.status === "posted")
    .reduce((sum, t) => sum + parseFloat(t.amount ?? "0"), 0);

  const postedCount = transactions.filter((t) => t.status === "posted").length;
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  return (
    <div>
      <Header
        title="Transactions"
        subtitle="Browse all payment transactions"
        onRefresh={loadTransactions}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card border border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-900/30 p-3 rounded-lg">
              <ArrowLeftRight className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold text-white">{transactions.length}</p>
            </div>
          </div>
        </div>

        <div className="card border border-green-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-green-900/30 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Posted Volume</p>
              <p className="text-2xl font-bold text-white">
                ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card border border-yellow-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-900/30 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Posted / Pending</p>
              <p className="text-2xl font-bold text-white">
                {postedCount} / {pendingCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, description, or idempotency key..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Status filter */}
            <div>
              <p className="text-gray-400 text-xs mb-2">Status</p>
              <div className="flex gap-2 flex-wrap">
                {["all", "posted", "pending", "reversed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      selectedStatus === s
                        ? "bg-primary-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filter */}
            <div>
              <p className="text-gray-400 text-xs mb-2">Type</p>
              <div className="flex gap-2 flex-wrap">
                {["all", "payment", "refund", "transfer", "fee"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      selectedType === t
                        ? "bg-primary-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {filtered.length} Transaction{filtered.length !== 1 ? "s" : ""}
          </h3>
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">ID</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Type</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Status</th>
                  <th className="text-right text-gray-400 text-sm font-medium pb-3">Amount</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3 pl-6">Description</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Date</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((txn) => (
                  <tr
                    key={txn.id}
                    className="hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-4">
                      <p className="text-white font-mono text-sm">
                        {txn.id.substring(0, 8)}...
                      </p>
                    </td>
                    <td className="py-4">
                      <span className={`${typeConfig[txn.type] ?? "badge-info"} capitalize`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5">
                        {statusConfig[txn.status]?.icon}
                        <span className={`${statusConfig[txn.status]?.class} capitalize`}>
                          {txn.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <span className="font-mono text-green-400 font-medium">
                        ${parseFloat(txn.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                        })}
                      </span>
                    </td>
                    <td className="py-4 pl-6">
                      <p className="text-gray-400 text-sm truncate max-w-48">
                        {txn.description ?? "—"}
                      </p>
                    </td>
                    <td className="py-4 text-gray-500 text-sm">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => setSelectedTxn(txn.id)}
                        className="text-primary-400 hover:text-primary-300 transition-colors p-1"
                        title="View detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No transactions found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      <TransactionModal
        transactionId={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
};
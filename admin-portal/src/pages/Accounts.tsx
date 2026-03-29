import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Search } from "lucide-react";
import { Header } from "../components/Header";
import { fetchAccounts } from "../lib/api";

const typeColors: Record<string, string> = {
  asset:     "badge-success",
  liability: "badge-danger",
  equity:    "badge-info",
  revenue:   "badge-warning",
  expense:   "badge-danger",
};

export const Accounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAccounts();
      setAccounts(res.data ?? []);
      setFiltered(res.data ?? []);
    } catch {
      setError("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    let result = accounts;
    if (search) {
      result = result.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (selectedType !== "all") {
      result = result.filter((a) => a.type === selectedType);
    }
    setFiltered(result);
  }, [search, selectedType, accounts]);

  const totalBalance = accounts.reduce(
    (sum, a) => sum + parseFloat(a.balance ?? "0"), 0
  );

  const assetBalance = accounts
    .filter((a) => a.type === "asset")
    .reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);

  const types = ["all", ...Array.from(new Set(accounts.map((a) => a.type)))];

  return (
    <div>
      <Header
        title="Accounts"
        subtitle="All ledger accounts and balances"
        onRefresh={loadAccounts}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card border border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-900/30 p-3 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Accounts</p>
              <p className="text-2xl font-bold text-white">{accounts.length}</p>
            </div>
          </div>
        </div>

        <div className="card border border-green-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-green-900/30 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Balance</p>
              <p className="text-2xl font-bold text-white">
                ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card border border-yellow-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-900/30 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Asset Balance</p>
              <p className="text-2xl font-bold text-white">
                ${assetBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  selectedType === type
                    ? "bg-primary-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {filtered.length} Account{filtered.length !== 1 ? "s" : ""}
          </h3>
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Name</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Type</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Currency</th>
                  <th className="text-right text-gray-400 text-sm font-medium pb-3">Balance</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3 pl-6">System</th>
                  <th className="text-left text-gray-400 text-sm font-medium pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-4">
                      <div>
                        <p className="text-white font-medium">{acc.name}</p>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">
                          {acc.id.substring(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`${typeColors[acc.type] ?? "badge-info"} capitalize`}>
                        {acc.type}
                      </span>
                    </td>
                    <td className="py-4 text-gray-400">{acc.currency}</td>
                    <td className="py-4 text-right">
                      <span className="font-mono text-green-400 font-medium">
                        ${parseFloat(acc.balance).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                        })}
                      </span>
                    </td>
                    <td className="py-4 pl-6">
                      {acc.isSystem === "true" ? (
                        <span className="badge-success">Yes</span>
                      ) : (
                        <span className="badge-info">No</span>
                      )}
                    </td>
                    <td className="py-4 text-gray-500 text-sm">
                      {new Date(acc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No accounts found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
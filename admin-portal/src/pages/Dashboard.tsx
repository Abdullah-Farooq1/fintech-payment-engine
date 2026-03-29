import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  Activity,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Header } from "../components/Header";
import { StatsCard } from "../components/StatsCard";
import { fetchAccounts, fetchLedgerBalance } from "../lib/api";

export const Dashboard = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [accountsRes, ledgerRes] = await Promise.all([
        fetchAccounts(),
        fetchLedgerBalance(),
      ]);
      setAccounts(accountsRes.data ?? []);
      setLedger(ledgerRes.data ?? null);
    } catch (err: any) {
      setError("Failed to load dashboard data. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance ?? "0"),
    0
  );

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Fintech Payment Engine — Admin Overview"
        onRefresh={loadData}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Accounts"
            value={accounts.length.toString()}
            subtitle="Active accounts"
            icon={Wallet}
            color="blue"
          />
          <StatsCard
            title="Total Balance"
            value={`$${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            subtitle="Across all accounts"
            icon={TrendingUp}
            color="green"
          />
          <StatsCard
            title="Total Debits"
            value={`$${parseFloat(ledger?.totalDebits ?? "0").toLocaleString()}`}
            subtitle="All time"
            icon={ArrowLeftRight}
            color="yellow"
          />
          <StatsCard
            title="Ledger Status"
            value={ledger?.isBalanced ? "Balanced" : "Unbalanced"}
            subtitle={`${ledger?.totalEntries ?? 0} total entries`}
            icon={Activity}
            color={ledger?.isBalanced ? "green" : "red"}
          />
        </div>
      )}

      {/* Accounts Table */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Account Balances
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
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
                  <th className="text-left text-gray-400 text-sm font-medium pb-3 pl-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 text-white font-medium">{acc.name}</td>
                    <td className="py-3">
                      <span className="badge-info capitalize">{acc.type}</span>
                    </td>
                    <td className="py-3 text-gray-400">{acc.currency}</td>
                    <td className="py-3 text-right font-mono text-green-400">
                      ${parseFloat(acc.balance).toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                      })}
                    </td>
                    <td className="py-3 pl-6">
                      {acc.isSystem === "true" ? (
                        <span className="badge-success">System</span>
                      ) : (
                        <span className="badge-info">Customer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger Summary */}
      {ledger && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            Ledger Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Total Debits</p>
              <p className="text-white font-mono font-bold">
                ${parseFloat(ledger.totalDebits).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Total Credits</p>
              <p className="text-white font-mono font-bold">
                ${parseFloat(ledger.totalCredits).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Difference</p>
              <p className="text-white font-mono font-bold">
                ${parseFloat(ledger.difference).toFixed(4)}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {ledger.isBalanced ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium text-sm">Balanced</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium text-sm">Unbalanced</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CreditCard,
  RotateCcw,
  Activity,
  Shield,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/accounts", icon: Wallet, label: "Accounts" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
  { to: "/refunds", icon: RotateCcw, label: "Refunds" },
  { to: "/ledger", icon: Activity, label: "Ledger" },
];

const roleColors: Record<string, string> = {
  admin:    "bg-red-900/30 text-red-300",
  merchant: "bg-blue-900/30 text-blue-300",
  customer: "bg-green-900/30 text-green-300",
};

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 h-screen flex flex-col fixed left-0 top-0">

      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">Fintech Engine</h1>
            <p className="text-gray-500 text-xs">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.email}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleColors[user.role] ?? "bg-gray-800 text-gray-400"}`}>
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-500 text-xs">All systems operational</span>
          </div>
        </div>
      )}
    </aside>
  );
};
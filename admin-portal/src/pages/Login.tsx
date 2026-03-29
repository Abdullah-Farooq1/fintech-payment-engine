import { useState } from "react";
import { Shield, Loader, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";

const DEMO_USERS = [
  {
    userId: "admin_001",
    email: "admin@fintech.com",
    role: "admin",
    label: "Admin",
    color: "bg-red-900/30 border-red-800/50 text-red-300",
  },
  {
    userId: "merchant_001",
    email: "merchant@fintech.com",
    role: "merchant",
    label: "Merchant",
    color: "bg-blue-900/30 border-blue-800/50 text-blue-300",
  },
  {
    userId: "customer_001",
    email: "customer@fintech.com",
    role: "customer",
    label: "Customer",
    color: "bg-green-900/30 border-green-800/50 text-green-300",
  },
];

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    userId: "",
    email: "",
    role: "admin",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fillDemo = (user: (typeof DEMO_USERS)[0]) => {
    setForm((prev) => ({
      ...prev,
      userId: user.userId,
      email: user.email,
      role: user.role,
      password: "demo123",
    }));
    setError(null);
  };

  const handleLogin = async () => {
    setError(null);

    if (!form.userId || !form.email) {
      setError("User ID and email are required");
      return;
    }

    try {
      setLoading(true);
      await login(form.userId, form.email, form.role);
      navigate("/");
    } catch (err: any) {
      setError(
        err.response?.data?.error ??
          "Login failed. Make sure Go gateway is running on port 8080."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Fintech Engine</h1>
          <p className="text-gray-400 mt-1">Admin Portal — Sign In</p>
        </div>

        {/* Demo Users */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm mb-3 text-center">
            Quick login with demo account
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.role}
                onClick={() => fillDemo(u)}
                className={`border rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80 ${u.color}`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Login Form */}
        <div className="card">
          <div className="space-y-4">

            {/* User ID */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                User ID
              </label>
              <input
                type="text"
                name="userId"
                value={form.userId}
                onChange={handleChange}
                placeholder="admin_001"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@fintech.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Role
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="merchant">Merchant</option>
                <option value="customer">Customer</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-gray-600 text-xs mt-1">
                Password is not validated in this demo
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
              onClick={handleLogin}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Fintech Payment Engine — Phase 6 Admin Portal
        </p>
      </div>
    </div>
  );
};
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Accounts } from "./pages/Accounts";
import { Transactions } from "./pages/Transactions";
import { Payments } from "./pages/Payments";
import { Refunds } from "./pages/Refunds";
import { Ledger } from "./pages/Ledger";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="payments" element={<Payments />} />
            <Route path="refunds" element={<Refunds />} />
            <Route path="ledger" element={<Ledger />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
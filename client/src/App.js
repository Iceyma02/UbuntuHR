import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import LoginPage   from "./pages/Login";
import Dashboard   from "./pages/Dashboard";
import Employees   from "./pages/Employees";
import Payroll     from "./pages/Payroll";
import Compliance  from "./pages/Compliance";
import Leave       from "./pages/Leave";
import Payslips    from "./pages/Payslips";
import Analytics   from "./pages/Analytics";
import "./index.css";

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--dark)", flexDirection: "column", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44,
          background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#0D0F14",
          animation: "pulse 1.5s infinite",
        }}>Z</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading ZimHR…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/employees"  element={<Employees />} />
          <Route path="/payroll"    element={<Payroll />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/leave"      element={<Leave />} />
          <Route path="/payslips"   element={<Payslips />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="*"           element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1A1E2A",
              color: "#F0EDE6",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              fontSize: 12,
            },
            success: { iconTheme: { primary: "#2DD4A0", secondary: "#0D0F14" } },
            error:   { iconTheme: { primary: "#FF5C5C", secondary: "#0D0F14" } },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*"     element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

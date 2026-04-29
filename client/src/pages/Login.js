import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login as apiLogin, register as apiRegister } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [mode, setMode]     = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({
    email: "", password: "", firstName: "", lastName: "", companyName: "",
  });
  const { login } = useAuth();
  const navigate  = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await apiLogin({ email: form.email, password: form.password });
        login(res.data.token, { ...res.data.user, company: res.data.company });
        toast.success(`Welcome back, ${res.data.user.firstName}!`);
        navigate("/dashboard");
      } else {
        const res = await apiRegister(form);
        login(res.data.token, { ...res.data.user, company: res.data.company });
        toast.success("Company registered! Welcome to ZimHR.");
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--dark)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,168,76,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(74,159,232,0.05) 0%,transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, margin: "0 auto 14px",
            background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
            borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#0D0F14",
            boxShadow: "0 8px 32px rgba(201,168,76,0.3)",
          }}>Z</div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
            ZimHR
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Zimbabwe's most powerful HR & Payroll system
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          borderRadius: 16, padding: 32,
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}>

          {/* Tabs */}
          <div className="tab-row" style={{ marginBottom: 24, width: "100%" }}>
            <button className={`tab-btn ${mode === "login" ? "active" : ""}`} style={{ flex: 1 }} onClick={() => setMode("login")}>Sign In</button>
            <button className={`tab-btn ${mode === "register" ? "active" : ""}`} style={{ flex: 1 }} onClick={() => setMode("register")}>Register Company</button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" placeholder="Acme Corporation Zimbabwe" value={form.companyName} onChange={set("companyName")} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input className="form-input" placeholder="Tendai" value={form.firstName} onChange={set("firstName")} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" placeholder="Moyo" value={form.lastName} onChange={set("lastName")} required />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="admin@company.co.zw" value={form.email} onChange={set("email")} required />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required minLength={8} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: "100%", padding: "11px", fontSize: 13, fontWeight: 600, marginTop: 8, justifyContent: "center" }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 16 }}>
              Don't have an account?{" "}
              <span onClick={() => setMode("register")} style={{ color: "var(--gold)", cursor: "pointer" }}>Register your company</span>
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", marginTop: 20 }}>
          ZIMRA · NSSA · Labour Act compliant · Built in Zimbabwe 🇿🇼
        </p>
      </div>
    </div>
  );
}

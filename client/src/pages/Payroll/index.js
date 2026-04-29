import { useState, useEffect } from "react";
import { getPayrollRuns, createPayrollRun, lockPayrollRun, exportBankFile } from "../../services/api";
import { calcPayroll, fmtUSD, formatPeriod, getStatusBadge, getInitials, getAvatarColor } from "../../utils/payroll";
import Topbar from "../../components/Topbar";
import toast from "react-hot-toast";

export default function Payroll() {
  const [runs, setRuns]       = useState([]);
  const [tab, setTab]         = useState("calculator");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Calculator state
  const [calc, setCalc] = useState({
    basicSalary: 1200, bonus: 0, commission: 0, allowances: 0, overtimeHours: 0,
  });
  const result = calcPayroll(calc);

  // New run state
  const [newRun, setNewRun] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    currency: "USD",
  });

  useEffect(() => {
    getPayrollRuns().then(r => setRuns(r.data)).catch(console.error);
  }, []);

  const handleCreateRun = async () => {
    setLoading(true);
    try {
      const res = await createPayrollRun(newRun);
      setRuns(prev => [res.data.run, ...prev]);
      setSelected(res.data);
      setTab("runs");
      toast.success(`Payroll for ${formatPeriod(`${newRun.year}-${String(newRun.month).padStart(2, "0")}`)} created!`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create payroll run");
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async (runId) => {
    try {
      await lockPayrollRun(runId);
      setRuns(prev => prev.map(r => r.id === runId ? { ...r, status: "LOCKED" } : r));
      toast.success("Payroll locked and finalized");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to lock");
    }
  };

  const handleExport = async (runId, bank) => {
    try {
      const res = await exportBankFile(runId, bank);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `zimhr_${bank}_export.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${bank.toUpperCase()} export downloaded`);
    } catch {
      toast.error("Export failed");
    }
  };

  const setC = (k) => (e) => setCalc(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Payroll Engine" actions={
        <button className="btn btn-primary" onClick={() => setTab("new")}>+ New Payroll Run</button>
      } />

      <div className="page-content">
        <div className="tab-row">
          {["calculator", "runs", "new"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "calculator" ? "💵 Calculator" : t === "runs" ? "📋 Payroll Runs" : "➕ New Run"}
            </button>
          ))}
        </div>

        {/* ── CALCULATOR ── */}
        {tab === "calculator" && (
          <div className="grid-65-35">
            <div className="card">
              <div className="card-header">
                <div className="card-title">ZIMRA PAYE Calculator — 2025/2026</div>
                <span className="badge badge-green">Live Calculation</span>
              </div>

              <div className="form-row-3" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Basic Salary (USD)</label>
                  <input className="form-input" type="number" value={calc.basicSalary} onChange={setC("basicSalary")} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bonus</label>
                  <input className="form-input" type="number" value={calc.bonus} onChange={setC("bonus")} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Commission</label>
                  <input className="form-input" type="number" value={calc.commission} onChange={setC("commission")} min="0" />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Allowances</label>
                  <input className="form-input" type="number" value={calc.allowances} onChange={setC("allowances")} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Overtime Hours</label>
                  <input className="form-input" type="number" value={calc.overtimeHours} onChange={setC("overtimeHours")} min="0" />
                </div>
              </div>

              {/* Tax bands reference */}
              <div style={{ background: "var(--dark)", borderRadius: 8, padding: 14, marginTop: 8 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  ZIMRA PAYE Tax Bands 2025/2026 (USD)
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Income Band</th>
                      <th>Rate</th>
                      <th>Applies to You?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { band: "$0 – $100", rate: "0%", lower: 0, upper: 100 },
                      { band: "$101 – $300", rate: "20%", lower: 100, upper: 300 },
                      { band: "$301 – $700", rate: "25%", lower: 300, upper: 700 },
                      { band: "$701 – $1,500", rate: "30%", lower: 700, upper: 1500 },
                      { band: "$1,501+", rate: "40%", lower: 1500, upper: null },
                    ].map((b, i) => {
                      const ti = result.taxableIncome;
                      const applies = ti > b.lower && (b.upper === null || ti > b.lower);
                      return (
                        <tr key={i} style={{ background: applies ? "rgba(201,168,76,0.04)" : "transparent" }}>
                          <td style={{ color: "var(--muted)" }}>{b.band}</td>
                          <td><span className={`badge ${b.rate === "0%" ? "badge-green" : b.rate === "40%" ? "badge-red" : "badge-gold"}`}>{b.rate}</span></td>
                          <td style={{ color: applies ? "var(--gold)" : "var(--muted)" }}>{applies ? "✓ Applies" : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                  Tax Credit: $900/month applied · AIDS Levy: 3% of PAYE · NSSA ceiling: no cap
                </div>
              </div>
            </div>

            {/* Breakdown panel */}
            <div>
              <div className="payroll-breakdown" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 14 }}>
                  Pay Breakdown
                </div>
                {[
                  { label: "Basic Salary", value: fmtUSD(result.basicSalary) },
                  { label: "Overtime Pay", value: fmtUSD(result.overtimePay) },
                  { label: "Bonus", value: fmtUSD(result.bonus) },
                  { label: "Commission", value: fmtUSD(result.commission) },
                  { label: "Allowances", value: fmtUSD(result.allowances) },
                ].map((r, i) => (
                  <div key={i} className="payroll-row">
                    <span style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span style={{ fontWeight: 500 }}>{r.value}</span>
                  </div>
                ))}
                <div className="payroll-row" style={{ color: "var(--text)", fontWeight: 600 }}>
                  <span>Gross Earnings</span>
                  <span>{fmtUSD(result.grossEarnings)}</span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                {[
                  { label: `PAYE (${result.effectiveTaxRate}% eff.)`, value: fmtUSD(result.paye), red: true },
                  { label: "AIDS Levy (3%)", value: fmtUSD(result.aidsLevy), red: true },
                  { label: "NSSA Employee (3.5%)", value: fmtUSD(result.nssaEmployee), red: true },
                  { label: "ZIMDEF Levy (1%)", value: fmtUSD(result.zimdef), red: true },
                ].map((r, i) => (
                  <div key={i} className="payroll-row">
                    <span style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span style={{ color: "var(--red)" }}>−{r.value}</span>
                  </div>
                ))}
                <div className="payroll-row total">
                  <span>NET PAY</span>
                  <span style={{ fontSize: 20, color: "var(--gold)" }}>{fmtUSD(result.netPay)}</span>
                </div>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  Employer Costs
                </div>
                {[
                  { label: "NSSA Employer (3.5%)", value: fmtUSD(result.nssaEmployer), red: true },
                  { label: "Standards Levy", value: fmtUSD(result.standardsLevy), red: true },
                  { label: "Total Cost to Company", value: fmtUSD(result.totalCostToCompany), bold: true, gold: true },
                ].map((r, i) => (
                  <div key={i} className="payroll-row">
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{r.label}</span>
                    <span style={{ fontSize: 11, color: r.gold ? "var(--gold)" : r.red ? "var(--red)" : "var(--text)", fontWeight: r.bold ? 600 : 500 }}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── NEW RUN ── */}
        {tab === "new" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Create Payroll Run</div>
              </div>
              <div className="alert alert-info">
                <span>ℹ</span>
                <span>ZimHR will automatically calculate PAYE, NSSA, and ZIMDEF for all active employees.</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Month</label>
                  <select className="form-select" value={newRun.month} onChange={e => setNewRun(p => ({ ...p, month: parseInt(e.target.value) }))}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2025, i, 1).toLocaleString("en-US", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <select className="form-select" value={newRun.year} onChange={e => setNewRun(p => ({ ...p, year: parseInt(e.target.value) }))}>
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-select" value={newRun.currency} onChange={e => setNewRun(p => ({ ...p, currency: e.target.value }))}>
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleCreateRun} disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: 11, marginTop: 8 }}>
                {loading ? "Processing…" : "Process Payroll →"}
              </button>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>What happens next</div>
              {[
                ["1", "Fetch all active employees", "var(--gold)"],
                ["2", "Calculate PAYE, NSSA & ZIMDEF per employee", "var(--blue)"],
                ["3", "Create payroll items for each employee", "var(--green)"],
                ["4", "Generate compliance logs for ZIMRA", "var(--purple)"],
                ["5", "Set status to DRAFT for your review", "var(--muted)"],
              ].map(([n, text, color]) => (
                <div key={n} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: n < "5" ? "1px solid var(--border2)" : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}22`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RUNS LIST ── */}
        {tab === "runs" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Payroll Run History</div>
            </div>
            {runs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💳</div>
                <div className="empty-title">No payroll runs yet</div>
                <div className="empty-desc">Create your first payroll run to get started</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Employees</th>
                    <th>Gross</th>
                    <th>PAYE</th>
                    <th>NSSA</th>
                    <th>Net Pay</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.id}>
                      <td style={{ fontWeight: 600 }}>{formatPeriod(run.period)}</td>
                      <td style={{ color: "var(--muted)" }}>{run.employeeCount}</td>
                      <td style={{ fontWeight: 500 }}>{fmtUSD(run.totalGross)}</td>
                      <td style={{ color: "var(--red)" }}>{fmtUSD(run.totalPaye)}</td>
                      <td style={{ color: "var(--red)" }}>{fmtUSD(run.totalNssa)}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>{fmtUSD(run.totalNet)}</td>
                      <td><span className={`badge ${getStatusBadge(run.status)}`}>{run.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {run.status === "DRAFT" && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleLock(run.id)}>Lock</button>
                          )}
                          {run.status === "LOCKED" && (
                            <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 10 }}
                              defaultValue="" onChange={e => { if (e.target.value) handleExport(run.id, e.target.value); }}>
                              <option value="">Export Bank</option>
                              <option value="cbz">CBZ</option>
                              <option value="stanbic">Stanbic</option>
                              <option value="fbc">FBC</option>
                              <option value="zbbank">ZB Bank</option>
                              <option value="steward">Steward</option>
                              <option value="ecocash">EcoCash</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

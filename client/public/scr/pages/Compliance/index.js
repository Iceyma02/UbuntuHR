import { useState, useEffect } from "react";
import { getCompliance, getTaxTables, generatePayeReturn, generateNssaReturn, calculatePenalty, fileCompliance, getPayrollRuns } from "../../services/api";
import { fmtUSD, formatPeriod } from "../../utils/payroll";
import Topbar from "../../components/Topbar";
import toast from "react-hot-toast";

const TAX_BANDS = [
  { band: "$0 – $100",     rate: "0%",  rateClass: "badge-green" },
  { band: "$101 – $300",   rate: "20%", rateClass: "badge-gold"  },
  { band: "$301 – $700",   rate: "25%", rateClass: "badge-gold"  },
  { band: "$701 – $1,500", rate: "30%", rateClass: "badge-red"   },
  { band: "$1,501+",       rate: "40%", rateClass: "badge-red"   },
];

export default function Compliance() {
  const [logs, setLogs]       = useState([]);
  const [runs, setRuns]       = useState([]);
  const [tab, setTab]         = useState("overview");
  const [penalty, setPenalty] = useState({ type: "PAYE", taxDue: 2000, monthsLate: 1, employeeCount: 47, result: null });

  useEffect(() => {
    getCompliance().then(r => setLogs(r.data)).catch(console.error);
    getPayrollRuns().then(r => setRuns(r.data)).catch(console.error);
  }, []);

  const downloadFile = async (fn, label) => {
    try {
      const res = await fn;
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = label; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} downloaded`);
    } catch { toast.error("Download failed"); }
  };

  const calcPenalty = async () => {
    try {
      const res = await calculatePenalty({ type: penalty.type, taxDue: penalty.taxDue, monthsLate: penalty.monthsLate, employeeCount: penalty.employeeCount });
      setPenalty(p => ({ ...p, result: res.data }));
    } catch { toast.error("Calculation failed"); }
  };

  const markFiled = async (id) => {
    try {
      await fileCompliance(id, { reference: `REF-${Date.now()}` });
      setLogs(prev => prev.map(l => l.id === id ? { ...l, status: "FILED", filedDate: new Date() } : l));
      toast.success("Marked as filed");
    } catch { toast.error("Failed to update"); }
  };

  const statusColor = { PENDING: "badge-gold", FILED: "badge-green", OVERDUE: "badge-red", LATE: "badge-red" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="ZIMRA Compliance" actions={
        runs[0] && (
          <button className="btn btn-primary"
            onClick={() => downloadFile(generatePayeReturn(runs[0].period), `ZIMRA_PAYE_${runs[0].period}.csv`)}>
            ↓ Download PAYE Return
          </button>
        )
      } />

      <div className="page-content">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: "Filed This Month", value: logs.filter(l => l.status === "FILED").length, color: "var(--green)", icon: "✅" },
            { label: "Pending Returns", value: logs.filter(l => l.status === "PENDING").length, color: "var(--orange)", icon: "⏳" },
            { label: "Overdue", value: logs.filter(l => l.status === "OVERDUE").length, color: "var(--red)", icon: "🚨" },
            { label: "Total PAYE Paid", value: fmtUSD(logs.filter(l => l.type === "PAYE" && l.status === "FILED").reduce((s, l) => s + (l.amount || 0), 0)), color: "var(--gold)", icon: "💰" },
          ].map((c, i) => (
            <div key={i} className="stat-card animate-fadeUp" style={{ animationDelay: `${i * 0.05}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div className="stat-label">{c.label}</div>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
              </div>
              <div className="stat-value" style={{ color: c.color, fontSize: 22 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="tab-row">
          {["overview", "tax-tables", "returns", "penalties"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "overview" ? "📋 Overview" : t === "tax-tables" ? "📊 Tax Tables" : t === "returns" ? "📄 Generate Returns" : "⚠ Penalties"}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Compliance Calendar</div></div>
              {logs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No compliance items</div>
                  <div className="empty-desc">Run a payroll to generate compliance obligations</div>
                </div>
              ) : logs.map((log, i) => (
                <div key={i} className="compliance-item">
                  <div className="compliance-icon" style={{
                    background: log.status === "FILED" ? "rgba(45,212,160,0.1)" : log.status === "OVERDUE" ? "rgba(255,92,92,0.1)" : "rgba(239,159,39,0.1)",
                    color: log.status === "FILED" ? "var(--green)" : log.status === "OVERDUE" ? "var(--red)" : "var(--orange)",
                    fontSize: 14,
                  }}>
                    {log.status === "FILED" ? "✓" : log.status === "OVERDUE" ? "!" : "→"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{log.type} — {log.period}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Due {new Date(log.dueDate).toLocaleDateString()}
                      {log.amount ? ` · ${fmtUSD(log.amount)}` : ""}
                      {log.filedDate ? ` · Filed ${new Date(log.filedDate).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className={`badge ${statusColor[log.status] || "badge-gray"}`}>{log.status}</span>
                    {log.status === "PENDING" && (
                      <button className="btn btn-sm btn-primary" onClick={() => markFiled(log.id)}>Mark Filed</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Statutory Rates Reference</div></div>
              {[
                { name: "NSSA Employee", rate: "3.5% of gross salary", color: "var(--blue)" },
                { name: "NSSA Employer", rate: "3.5% of gross salary", color: "var(--purple)" },
                { name: "ZIMDEF Levy", rate: "1% of basic salary", color: "var(--gold)" },
                { name: "AIDS Levy", rate: "3% of PAYE payable", color: "var(--orange)" },
                { name: "Standards Levy", rate: "$2.00 per employee/month", color: "var(--green)" },
                { name: "Tax Credit (USD)", rate: "$900 per employee/month", color: "var(--green)" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < 5 ? "1px solid var(--border2)" : "none" }}>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{item.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.rate}</span>
                </div>
              ))}

              <div style={{ marginTop: 14, padding: 12, background: "var(--dark)", borderRadius: 8, fontSize: 11, color: "var(--muted)" }}>
                📌 Labour Act Chapter 28:01 · Finance Act 2025 · NSSA Act · ZIMDEF Act
              </div>
            </div>
          </div>
        )}

        {/* TAX TABLES */}
        {tab === "tax-tables" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">PAYE Tax Bands — USD 2025/2026</div>
                <span className="badge badge-green">Current</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Income Band</th><th>Rate</th><th>Tax on Band</th><th>Cumulative</th></tr>
                </thead>
                <tbody>
                  {[
                    { band: "$0 – $100", rate: "0%", cls: "badge-green", band_tax: "$0", cum: "$0" },
                    { band: "$101 – $300", rate: "20%", cls: "badge-gold", band_tax: "Up to $40", cum: "$40" },
                    { band: "$301 – $700", rate: "25%", cls: "badge-gold", band_tax: "Up to $100", cum: "$140" },
                    { band: "$701 – $1,500", rate: "30%", cls: "badge-red", band_tax: "Up to $240", cum: "$380" },
                    { band: "$1,501+", rate: "40%", cls: "badge-red", band_tax: "On excess", cum: "Progressive" },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--muted)" }}>{r.band}</td>
                      <td><span className={`badge ${r.cls}`}>{r.rate}</span></td>
                      <td>{r.band_tax}</td>
                      <td style={{ color: "var(--text2)" }}>{r.cum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: 12, background: "var(--dark)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  💡 Monthly Tax Credit: <strong style={{ color: "var(--green)" }}>$900</strong> deducted after tax calculation · AIDS Levy (3%) applied on positive PAYE only · Auto-updates every December budget
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">PAYE Tax Bands — ZiG 2025/2026</div>
                <span className="badge badge-blue">ZiG</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Income Band (ZiG)</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {[
                    { band: "ZiG 0 – 1,404", rate: "0%" },
                    { band: "ZiG 1,405 – 4,212", rate: "20%" },
                    { band: "ZiG 4,213 – 9,828", rate: "25%" },
                    { band: "ZiG 9,829 – 21,060", rate: "30%" },
                    { band: "ZiG 21,061+", rate: "40%" },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--muted)" }}>{r.band}</td>
                      <td><span className={`badge ${r.rate === "0%" ? "badge-green" : r.rate === "40%" ? "badge-red" : "badge-gold"}`}>{r.rate}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: 12, background: "var(--dark)", borderRadius: 8, fontSize: 11, color: "var(--muted)" }}>
                ZiG Tax Credit: <strong style={{ color: "var(--green)" }}>ZiG 12,636/month</strong>
              </div>
            </div>
          </div>
        )}

        {/* GENERATE RETURNS */}
        {tab === "returns" && (
          <div className="card">
            <div className="card-header"><div className="card-title">Generate Statutory Returns</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {runs.map(run => (
                <div key={run.id} style={{ background: "var(--dark)", borderRadius: 10, padding: 16, border: "1px solid var(--border2)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, marginBottom: 4 }}>{formatPeriod(run.period)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                    {run.employeeCount} employees · PAYE {fmtUSD(run.totalPaye)} · NSSA {fmtUSD(run.totalNssa)}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-sm btn-primary"
                      onClick={() => downloadFile(generatePayeReturn(run.period), `ZIMRA_PAYE_${run.period}.csv`)}>
                      ↓ ZIMRA PAYE Return
                    </button>
                    <button className="btn btn-sm"
                      onClick={() => downloadFile(generateNssaReturn(run.period), `NSSA_Return_${run.period}.csv`)}>
                      ↓ NSSA Return
                    </button>
                  </div>
                </div>
              ))}
              {runs.length === 0 && (
                <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                  <div className="empty-icon">📄</div>
                  <div className="empty-title">No payroll runs yet</div>
                  <div className="empty-desc">Run payroll first to generate statutory returns</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PENALTIES */}
        {tab === "penalties" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Penalty Calculator</div></div>
              <div className="form-group">
                <label className="form-label">Obligation Type</label>
                <select className="form-select" value={penalty.type} onChange={e => setPenalty(p => ({ ...p, type: e.target.value }))}>
                  <option value="PAYE">PAYE</option>
                  <option value="NSSA">NSSA</option>
                  <option value="P6">P6 Certificate</option>
                </select>
              </div>
              {penalty.type === "PAYE" && (
                <div className="form-group">
                  <label className="form-label">Tax Due (USD)</label>
                  <input className="form-input" type="number" value={penalty.taxDue} onChange={e => setPenalty(p => ({ ...p, taxDue: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}
              {penalty.type === "P6" && (
                <div className="form-group">
                  <label className="form-label">Number of Employees</label>
                  <input className="form-input" type="number" value={penalty.employeeCount} onChange={e => setPenalty(p => ({ ...p, employeeCount: parseInt(e.target.value) || 0 }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Months Late</label>
                <input className="form-input" type="number" min="1" max="24" value={penalty.monthsLate} onChange={e => setPenalty(p => ({ ...p, monthsLate: parseInt(e.target.value) || 1 }))} />
              </div>
              <button className="btn btn-primary" onClick={calcPenalty} style={{ width: "100%", justifyContent: "center" }}>
                Calculate Penalty
              </button>

              {penalty.result && (
                <div style={{ marginTop: 16, background: "rgba(255,92,92,0.06)", border: "1px solid rgba(255,92,92,0.2)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, color: "var(--red)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Penalty Breakdown</div>
                  {[
                    { label: "Base Penalty", value: fmtUSD(penalty.result.basePenalty) },
                    { label: "Interest Penalty", value: fmtUSD(penalty.result.interestPenalty) },
                    { label: "Total Penalty", value: fmtUSD(penalty.result.total), bold: true },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? "1px solid rgba(255,92,92,0.1)" : "none" }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.label}</span>
                      <span style={{ fontSize: r.bold ? 16 : 12, fontWeight: r.bold ? 700 : 500, color: "var(--red)", fontFamily: r.bold ? "'Syne',sans-serif" : "inherit" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">ZIMRA Penalty Reference</div></div>
              {[
                { type: "PAYE Late Filing", penalty: "$200 base + 10% of tax per month", color: "var(--red)" },
                { type: "NSSA Late Filing", penalty: "$200 per month overdue", color: "var(--red)" },
                { type: "P6 Certificate", penalty: "$30 per employee per month", color: "var(--orange)" },
                { type: "ZIMDEF Late", penalty: "Penalty + interest", color: "var(--orange)" },
              ].map((item, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--border2)" : "none" }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{item.type}</div>
                  <div style={{ fontSize: 12, color: item.color }}>{item.penalty}</div>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: 12, background: "rgba(45,212,160,0.06)", border: "1px solid rgba(45,212,160,0.15)", borderRadius: 8, fontSize: 11, color: "var(--green)" }}>
                ✅ ZimHR sends compliance reminders 7 days before every due date so you never miss a deadline.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

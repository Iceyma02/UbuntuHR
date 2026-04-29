import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getAnalyticsDashboard } from "../../services/api";
import { fmtUSD, formatPeriod } from "../../utils/payroll";
import Topbar from "../../components/Topbar";

const CHART_STYLE = {
  tooltip: { contentStyle: { background: "#1A1E2A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11 }, labelStyle: { color: "#F0EDE6" }, itemStyle: { color: "#C9A84C" } },
};

export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate            = useNavigate();

  useEffect(() => {
    getAnalyticsDashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const s = data?.summary || {};
  const trend = (data?.payrollTrend || []).slice(-8).map(r => ({
    name: r.period?.slice(5),
    gross: r.gross, net: r.net, paye: r.paye,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Dashboard" actions={
        <button className="btn btn-primary" onClick={() => navigate("/payroll")}>+ Run Payroll</button>
      } />

      <div className="page-content">
        {/* Stat cards */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: "Total Employees", value: s.totalEmployees || 0, change: `${s.activeEmployees || 0} active`, color: "var(--gold)", icon: "👥" },
            { label: "Payroll This Month", value: fmtUSD(s.currentMonthPayroll || 0), change: `Net: ${fmtUSD(s.currentMonthNet || 0)}`, color: "var(--green)", icon: "💵" },
            { label: "ZIMRA Liability", value: fmtUSD(s.zimraLiability || 0), change: "Pending filing", color: "var(--red)", icon: "⚖️" },
            { label: "Leave Requests", value: s.pendingLeave || 0, change: "Awaiting approval", color: "var(--blue)", icon: "📅" },
          ].map((c, i) => (
            <div key={i} className="stat-card animate-fadeUp" style={{ animationDelay: `${i * 0.05}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stat-label">{c.label}</div>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
              </div>
              <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
              <div className="stat-change" style={{ color: "var(--muted)" }}>{c.change}</div>
            </div>
          ))}
        </div>

        <div className="grid-65-35" style={{ marginBottom: 16 }}>
          {/* Payroll trend chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Payroll Cost Trend</div>
              <button className="btn btn-sm" onClick={() => navigate("/analytics")}>Full Analytics →</button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip {...CHART_STYLE.tooltip} formatter={v => fmtUSD(v)} />
                <Area type="monotone" dataKey="gross" stroke="#C9A84C" fill="url(#goldGrad)" strokeWidth={2} dot={false} name="Gross" />
                <Area type="monotone" dataKey="net" stroke="#2DD4A0" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Net" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Compliance */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Compliance Status</div>
              <button className="btn btn-sm" onClick={() => navigate("/compliance")}>View All →</button>
            </div>
            {(data?.complianceLogs || []).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-title">All clear</div>
                <div className="empty-desc">No pending compliance items</div>
              </div>
            ) : (
              (data?.complianceLogs || []).slice(0, 5).map((c, i) => (
                <div key={i} className="compliance-item">
                  <div className="compliance-icon" style={{ background: c.status === "OVERDUE" ? "rgba(255,92,92,0.1)" : "rgba(239,159,39,0.1)", color: c.status === "OVERDUE" ? "var(--red)" : "var(--orange)" }}>
                    {c.status === "OVERDUE" ? "!" : "→"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{c.type} — {c.period}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Due {new Date(c.dueDate).toLocaleDateString()}
                      {c.amount ? ` · ${fmtUSD(c.amount)}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${c.status === "OVERDUE" ? "badge-red" : "badge-gold"}`}>{c.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid-2">
          {/* Department headcount */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Headcount by Department</div>
            </div>
            {(data?.deptStats || []).map((d, i) => {
              const maxSalary = Math.max(...(data?.deptStats || []).map(x => x.totalSalary));
              const pct = maxSalary > 0 ? (d.totalSalary / maxSalary) * 100 : 0;
              const colors = ["var(--gold)", "var(--blue)", "var(--green)", "var(--purple)", "var(--muted)"];
              return (
                <div key={i} className="dept-bar-row">
                  <div className="dept-name">{d.name}</div>
                  <div className="dept-bar-wrap">
                    <div className="dept-bar-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)", width: 80, textAlign: "right", flexShrink: 0 }}>
                    {d.headcount} · {fmtUSD(d.totalSalary)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ZIMRA Forecast */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">ZIMRA Forecast — Next 3 Months</div>
            </div>
            {(data?.forecast || []).map((f, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < 2 ? "1px solid var(--border2)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{formatPeriod(f.period)}</span>
                  <span style={{ fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: 700, color: i === 0 ? "var(--gold)" : "var(--text)" }}>
                    {fmtUSD(f.estimatedPaye)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>Due {new Date(f.dueDate).toLocaleDateString()}</span>
                  {i === 0 && <span className="badge badge-gold">Due Soon</span>}
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${100 - i * 15}%`, background: i === 0 ? "var(--gold)" : "var(--muted)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

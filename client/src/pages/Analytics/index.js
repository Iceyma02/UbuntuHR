import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getAnalyticsDashboard, getLeaveUtilization } from "../../services/api";
import { fmtUSD, formatPeriod } from "../../utils/payroll";
import Topbar from "../../components/Topbar";

const COLORS = ["#C9A84C", "#4A9FE8", "#2DD4A0", "#9B7FE8", "#FF5C5C", "#EF9F27"];

const TIP = {
  contentStyle: { background: "#1A1E2A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11 },
  labelStyle: { color: "#F0EDE6" },
};

export default function Analytics() {
  const [data, setData]         = useState(null);
  const [leaveUtil, setLeave]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      getAnalyticsDashboard(),
      getLeaveUtilization(),
    ]).then(([d, l]) => {
      setData(d.data);
      setLeave(l.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const s = data?.summary || {};
  const trend = (data?.payrollTrend || []).slice(-12).map(r => ({
    name: r.period?.slice(5),
    Gross: r.gross, Net: r.net, PAYE: r.paye,
  }));

  const currencyData = [
    { name: "USD", value: 78 },
    { name: "ZiG", value: 22 },
  ];

  const deptData = (data?.deptStats || []).map(d => ({
    name: d.name, Headcount: d.headcount, Salary: d.totalSalary,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Analytics" actions={
        <button className="btn btn-primary">↓ Export Report PDF</button>
      } />

      <div className="page-content">
        {/* KPI Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Annual Payroll", value: fmtUSD((data?.payrollTrend || []).reduce((s, r) => s + r.gross, 0)) },
            { label: "Avg Salary", value: fmtUSD(s.totalEmployees > 0 ? (s.currentMonthPayroll || 0) / s.totalEmployees : 0) },
            { label: "Total Employees", value: s.totalEmployees || 0 },
            { label: "PAYE Paid YTD", value: fmtUSD((data?.payrollTrend || []).reduce((s, r) => s + r.paye, 0)) },
            { label: "Leave Pending", value: s.pendingLeave || 0 },
            { label: "ZIMRA Liability", value: fmtUSD(s.zimraLiability || 0) },
          ].map((k, i) => (
            <div key={i} style={{ background: "var(--card2)", border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>{k.label}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          {/* Payroll trend */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Payroll Trend — 12 Months</div>
              <span className="badge badge-gold">USD</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2DD4A0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2DD4A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip {...TIP} formatter={v => fmtUSD(v)} />
                <Area type="monotone" dataKey="Gross" stroke="#C9A84C" fill="url(#g1)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Net" stroke="#2DD4A0" fill="url(#g2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Dept headcount & salary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Salary by Department</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip {...TIP} formatter={v => fmtUSD(v)} />
                <Bar dataKey="Salary" fill="#C9A84C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-65-35" style={{ marginBottom: 16 }}>
          {/* PAYE vs Net comparison */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Gross vs Net vs PAYE Comparison</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend.slice(-6)}>
                <XAxis dataKey="name" tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A8FA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip {...TIP} formatter={v => fmtUSD(v)} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#8A8FA0" }} />
                <Bar dataKey="Gross" fill="rgba(201,168,76,0.6)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net" fill="#2DD4A0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="PAYE" fill="rgba(255,92,92,0.7)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Currency split */}
          <div className="card">
            <div className="card-header"><div className="card-title">Currency Split</div></div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={currencyData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {currencyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={TIP.contentStyle} formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
              {currencyData.map((d, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i], display: "inline-block" }} />
                  <span style={{ color: "var(--muted)" }}>{d.name}</span>
                  <span style={{ fontWeight: 600 }}>{d.value}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Leave utilization */}
        {leaveUtil.length > 0 && (
          <div className="card">
            <div className="card-header"><div className="card-title">Leave Utilization — {new Date().getFullYear()}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {leaveUtil.map((l, i) => (
                <div key={i} style={{ background: "var(--dark)", borderRadius: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{l.type}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: l.utilizationPct > 80 ? "var(--red)" : l.utilizationPct > 50 ? "var(--orange)" : "var(--green)" }}>
                      {l.utilizationPct}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${l.utilizationPct}%`,
                      background: l.utilizationPct > 80 ? "var(--red)" : l.utilizationPct > 50 ? "var(--orange)" : "var(--green)",
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
                    {l.used} used · {l.entitled} entitled
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

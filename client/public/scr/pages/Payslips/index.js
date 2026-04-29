import { useState, useEffect } from "react";
import { getPayrollRuns, bulkGeneratePayslips, generatePayslipHtml } from "../../services/api";
import { fmtUSD, formatPeriod, getStatusBadge } from "../../utils/payroll";
import Topbar from "../../components/Topbar";
import toast from "react-hot-toast";

export default function Payslips() {
  const [runs, setRuns]         = useState([]);
  const [selectedRun, setRun]   = useState(null);
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    getPayrollRuns().then(r => { setRuns(r.data); if (r.data[0]) setRun(r.data[0]); }).catch(console.error);
  }, []);

  const handleBulkGenerate = async (runId) => {
    setLoading(true);
    try {
      const res = await bulkGeneratePayslips(runId);
      toast.success(`${res.data.count} payslips generated!`);
    } catch (err) {
      toast.error("Failed to generate payslips");
    } finally { setLoading(false); }
  };

  const handlePreview = async (runId, empId) => {
    try {
      const res = await generatePayslipHtml(runId, empId);
      setPreview(res.data);
    } catch { toast.error("Preview failed"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Payslips" actions={
        selectedRun && (
          <button className="btn btn-primary" onClick={() => handleBulkGenerate(selectedRun.id)} disabled={loading}>
            {loading ? "Generating…" : "⚡ Bulk Generate All"}
          </button>
        )
      } />

      <div className="page-content">
        <div className="grid-7-3">
          {/* Payroll runs list */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><div className="card-title">Select Payroll Period</div></div>
              {runs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <div className="empty-title">No payroll runs yet</div>
                  <div className="empty-desc">Create a payroll run first</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {runs.map(run => (
                    <div key={run.id}
                      onClick={() => setRun(run)}
                      style={{
                        padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                        background: selectedRun?.id === run.id ? "rgba(201,168,76,0.08)" : "var(--dark)",
                        border: `1px solid ${selectedRun?.id === run.id ? "var(--border)" : "var(--border2)"}`,
                        transition: "all 0.12s",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13 }}>
                          {formatPeriod(run.period)}
                        </div>
                        <span className={`badge ${getStatusBadge(run.status)}`}>{run.status}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{run.employeeCount} employees</span>
                        <span style={{ fontSize: 11, color: "var(--green)" }}>Net: {fmtUSD(run.totalNet)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Gross: {fmtUSD(run.totalGross)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedRun && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Delivery Options — {formatPeriod(selectedRun.period)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { icon: "⚡", label: "Bulk Generate PDFs", sub: `All ${selectedRun.employeeCount} payslips`, action: () => handleBulkGenerate(selectedRun.id) },
                    { icon: "📱", label: "Send via WhatsApp", sub: "WhatsApp Business API", action: () => toast("WhatsApp delivery coming soon") },
                    { icon: "📧", label: "Email All Staff", sub: "Send to company emails", action: () => toast("Email delivery coming soon") },
                    { icon: "📥", label: "Export ZIP", sub: "All PDFs in one file", action: () => toast("ZIP export coming soon") },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} className="btn" style={{
                      flexDirection: "column", padding: 14, height: "auto",
                      background: "var(--dark)", textAlign: "left", gap: 4,
                    }}>
                      <span style={{ fontSize: 20 }}>{btn.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{btn.label}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>{btn.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payslip preview / instructions */}
          <div>
            {preview ? (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Payslip Preview</div>
                  <button className="btn btn-sm" onClick={() => setPreview(null)}>✕ Close</button>
                </div>
                <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border2)" }}>
                  <iframe srcDoc={preview} style={{ width: "100%", height: 500, border: "none" }} title="Payslip Preview" />
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header"><div className="card-title">ZimHR Payslip Features</div></div>
                {[
                  { icon: "🏢", title: "Branded Payslips", desc: "Company logo, colours and letterhead on every payslip" },
                  { icon: "📱", title: "WhatsApp Delivery", desc: "Send payslips directly to employee WhatsApp numbers" },
                  { icon: "📧", title: "Email Delivery", desc: "Auto-email payslips to all staff in one click" },
                  { icon: "🔒", title: "Locked & Tamper-proof", desc: "PDF payslips are locked once the payroll run is locked" },
                  { icon: "📊", title: "YTD Summary", desc: "Year-to-date earnings, deductions and tax on every payslip" },
                  { icon: "💱", title: "Dual Currency", desc: "USD and ZiG payslips with correct formatting" },
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < 5 ? "1px solid var(--border2)" : "none" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{f.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

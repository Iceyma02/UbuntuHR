import { useState, useEffect } from "react";
import { getLeaveRequests, createLeaveRequest, actionLeaveRequest, getLeaveLiability, getLeaveTypes, getPublicHolidays, getEmployees } from "../../services/api";
import { getInitials, getAvatarColor, fmtUSD } from "../../utils/payroll";
import Topbar from "../../components/Topbar";
import toast from "react-hot-toast";

const TYPE_COLORS = { AL: "badge-blue", SL: "badge-red", ML: "badge-purple", PL: "badge-blue", CL: "badge-gold", UPL: "badge-gray" };

export default function Leave() {
  const [requests, setRequests]     = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [liability, setLiability]   = useState(null);
  const [holidays, setHolidays]     = useState([]);
  const [tab, setTab]               = useState("requests");
  const [showModal, setShowModal]   = useState(false);
  const [loading, setLoading]       = useState(false);

  const [form, setForm] = useState({
    employeeId: "", leaveTypeId: "", startDate: "", endDate: "", reason: "",
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    getLeaveRequests().then(r => setRequests(r.data)).catch(console.error);
    getLeaveTypes().then(r => setLeaveTypes(r.data)).catch(console.error);
    getEmployees({ status: "ACTIVE" }).then(r => setEmployees(r.data)).catch(console.error);
    getLeaveLiability().then(r => setLiability(r.data)).catch(console.error);
    getPublicHolidays(new Date().getFullYear()).then(r => setHolidays(r.data)).catch(console.error);
  }, []);

  const handleCreate = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createLeaveRequest(form);
      setRequests(p => [res.data, ...p]);
      setShowModal(false);
      toast.success("Leave request submitted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit");
    } finally { setLoading(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await actionLeaveRequest(id, action);
      setRequests(p => p.map(r => r.id === id ? { ...r, status: action === "approve" ? "APPROVED" : "REJECTED" } : r));
      toast.success(`Leave ${action}d`);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    }
  };

  const statusBadge = { PENDING: "badge-gold", APPROVED: "badge-green", REJECTED: "badge-red", CANCELLED: "badge-gray" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Leave Management" actions={
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Request Leave</button>
      } />

      <div className="page-content">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: "Pending Approval", value: requests.filter(r => r.status === "PENDING").length, color: "var(--orange)" },
            { label: "Approved This Month", value: requests.filter(r => r.status === "APPROVED").length, color: "var(--green)" },
            { label: "On Leave Today", value: requests.filter(r => r.status === "APPROVED" && new Date(r.startDate) <= new Date() && new Date(r.endDate) >= new Date()).length, color: "var(--blue)" },
            { label: "Leave Liability", value: liability ? fmtUSD(liability.totalLiability) : "—", color: "var(--red)" },
          ].map((c, i) => (
            <div key={i} className="stat-card animate-fadeUp" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="stat-label">{c.label}</div>
              <div className="stat-value" style={{ color: c.color, fontSize: 24 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="tab-row">
          {["requests", "entitlements", "liability", "holidays"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "requests" ? "📋 Requests" : t === "entitlements" ? "⚖️ Entitlements" : t === "liability" ? "💰 Liability" : "📅 Public Holidays"}
            </button>
          ))}
        </div>

        {/* REQUESTS */}
        {tab === "requests" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Leave Requests</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="badge badge-gold">{requests.filter(r => r.status === "PENDING").length} Pending</span>
              </div>
            </div>
            {requests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <div className="empty-title">No leave requests</div>
                <div className="empty-desc">All employees are present</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Leave Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="avatar" style={{ background: getAvatarColor(`${req.employee?.firstName}`) }}>
                            {getInitials(req.employee?.firstName || "", req.employee?.lastName || "")}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{req.employee?.firstName} {req.employee?.lastName}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{req.employee?.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${TYPE_COLORS[req.leaveType?.code] || "badge-gray"}`}>{req.leaveType?.name}</span></td>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>
                        {new Date(req.startDate).toLocaleDateString()} — {new Date(req.endDate).toLocaleDateString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{req.totalDays}d</td>
                      <td style={{ color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {req.reason || "—"}
                      </td>
                      <td><span className={`badge ${statusBadge[req.status] || "badge-gray"}`}>{req.status}</span></td>
                      <td>
                        {req.status === "PENDING" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => handleAction(req.id, "approve")}>✓ Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleAction(req.id, "reject")}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ENTITLEMENTS */}
        {tab === "entitlements" && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Zimbabwe Labour Act — Leave Entitlements</div><span className="badge badge-blue">Ch 28:01</span></div>
              {leaveTypes.map((lt, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < leaveTypes.length - 1 ? "1px solid var(--border2)" : "none" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{lt.name}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{lt.labourActRef || "Company Policy"} · {lt.isPaid ? "Paid" : "Unpaid"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                      {lt.daysPerYear > 0 ? `${lt.daysPerYear} days` : "Variable"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>per year</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Leave Types Summary</div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {leaveTypes.map((lt, i) => (
                  <div key={i} style={{ background: "var(--dark)", borderRadius: 8, padding: 12 }}>
                    <div className={`badge ${Object.values(TYPE_COLORS)[i % 6] || "badge-gray"}`} style={{ marginBottom: 8 }}>{lt.code}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{lt.name}</div>
                    <div style={{ fontSize: 18, fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>
                      {lt.daysPerYear || "∞"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{lt.isPaid ? "Paid leave" : "Unpaid"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LIABILITY */}
        {tab === "liability" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Leave Liability Report</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Exposure:</span>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--red)", fontSize: 16 }}>
                  {liability ? fmtUSD(liability.totalLiability) : "—"}
                </span>
              </div>
            </div>
            {liability?.report?.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Salary</th><th>Entitled</th><th>Used</th><th>Remaining</th><th>Cash Value</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {liability.report.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td style={{ color: "var(--muted)" }}>{fmtUSD(r.basicSalary)}</td>
                      <td>{r.entitled}d</td>
                      <td style={{ color: "var(--muted)" }}>{r.used}d</td>
                      <td style={{ color: "var(--gold)", fontWeight: 600 }}>{r.remaining}d</td>
                      <td style={{ color: "var(--red)", fontWeight: 600 }}>{fmtUSD(r.cashValue)}</td>
                      <td><span className={`badge ${r.risk === "HIGH" ? "badge-red" : r.risk === "MEDIUM" ? "badge-gold" : "badge-green"}`}>{r.risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <div className="empty-title">No data yet</div>
                <div className="empty-desc">Add employees and leave balances to see liability</div>
              </div>
            )}
          </div>
        )}

        {/* HOLIDAYS */}
        {tab === "holidays" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Zimbabwe Public Holidays — {new Date().getFullYear()}</div>
              <span className="badge badge-green">{holidays.length} Holidays</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {holidays.map((h, i) => (
                <div key={i} style={{ background: "var(--dark)", borderRadius: 8, padding: 12, border: "1px solid var(--border2)" }}>
                  <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>
                    {new Date(h.date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{h.name}</div>
                  {!h.isFixed && <span className="badge badge-purple" style={{ marginTop: 6 }}>Variable</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Leave Request</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Employee *</label>
                <select className="form-select" value={form.employeeId} onChange={setF("employeeId")} required>
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Leave Type *</label>
                <select className="form-select" value={form.leaveTypeId} onChange={setF("leaveTypeId")} required>
                  <option value="">Select Type</option>
                  {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.daysPerYear}d/yr)</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" value={form.startDate} onChange={setF("startDate")} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input className="form-input" type="date" value={form.endDate} onChange={setF("endDate")} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-textarea" value={form.reason} onChange={setF("reason")} placeholder="Optional reason…" />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: "center" }}>
                  {loading ? "Submitting…" : "Submit Request"}
                </button>
                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

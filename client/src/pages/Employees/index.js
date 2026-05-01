import { useState, useEffect } from "react";
import { getEmployees, createEmployee, getDepartments, createDepartment } from "../../services/api";
import { getInitials, getAvatarColor, getStatusBadge, fmtUSD } from "../../utils/payroll";
import Topbar from "../../components/Topbar";
import toast from "react-hot-toast";

const CONTRACT_TYPES = ["PERMANENT", "CONTRACT", "CASUAL", "PART_TIME", "INTERN"];
const PAYMENT_METHODS = ["BANK_TRANSFER", "ECOCASH", "CASH", "ZIPIT"];
const BANKS = ["CBZ", "Stanbic", "FBC", "ZB Bank", "Steward Bank", "NMB", "BancABC", "Nedbank Zimbabwe"];

export default function Employees() {
  const [employees, setEmployees]   = useState([]);
  const [departments, setDepts]     = useState([]);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", nationalId: "",
    taxNumber: "", nssaNumber: "", dateOfBirth: "", gender: "MALE",
    jobTitle: "", departmentId: "", contractType: "PERMANENT",
    basicSalary: "", currency: "USD",
    paymentMethod: "BANK_TRANSFER", bankName: "", bankAccount: "",
    ecocashNumber: "", startDate: "", address: "",
    nextOfKin: "", nextOfKinPhone: "",
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, []);

  const loadEmployees = () => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    getEmployees(params).then(r => setEmployees(r.data)).catch(console.error);
  };

  const loadDepartments = () => {
    getDepartments().then(r => setDepts(r.data)).catch(console.error);
  };

  useEffect(() => { loadEmployees(); }, [search, statusFilter]);

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.error("Department name required");
      return;
    }
    try {
      const res = await createDepartment({ name: newDeptName });
      setDepts(prev => [...prev, res.data]);
      setShowDeptModal(false);
      setNewDeptName("");
      toast.success("Department created successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create department");
    }
  };

  const handleCreate = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { 
        ...form, 
        basicSalary: parseFloat(form.basicSalary),
        // Ensure empty strings are sent as null for optional fields
        departmentId: form.departmentId || null,
        ecocashNumber: form.ecocashNumber || null,
        address: form.address || null,
        nextOfKin: form.nextOfKin || null,
        nextOfKinPhone: form.nextOfKinPhone || null,
      };
      const res = await createEmployee(payload);
      setEmployees(p => [res.data, ...p]);
      setShowModal(false);
      // Reset form
      setForm({ 
        firstName: "", lastName: "", email: "", phone: "", nationalId: "",
        taxNumber: "", nssaNumber: "", dateOfBirth: "", gender: "MALE",
        jobTitle: "", departmentId: "", contractType: "PERMANENT",
        basicSalary: "", currency: "USD",
        paymentMethod: "BANK_TRANSFER", bankName: "", bankAccount: "",
        ecocashNumber: "", startDate: "", address: "",
        nextOfKin: "", nextOfKinPhone: "",
      });
      const handleExportCSV = () => {
  if (filtered.length === 0) {
    toast.error("No employees to export");
    return;
  }
  
  const headers = [
    "Employee Number", "First Name", "Last Name", "Email", "Phone",
    "Department", "Job Title", "Contract Type", "Employment Status",
    "Basic Salary", "Currency", "Payment Method", "Bank Name", "Bank Account",
    "National ID", "ZIMRA Tax Number", "NSSA Number", "Start Date", "Date of Birth"
  ];
  
  const rows = filtered.map(emp => [
    emp.employeeNumber || "",
    emp.firstName || "",
    emp.lastName || "",
    emp.email || "",
    emp.phone || "",
    emp.department?.name || "",
    emp.jobTitle || "",
    emp.contractType || "",
    emp.employmentStatus || "",
    emp.basicSalary || 0,
    emp.currency || "USD",
    emp.paymentMethod || "",
    emp.bankName || "",
    emp.bankAccount || "",
    emp.nationalId || "",
    emp.taxNumber || "",
    emp.nssaNumber || "",
    emp.startDate ? new Date(emp.startDate).toLocaleDateString() : "",
    emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : "",
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`${filtered.length} employees exported`);
};
      toast.success(`${res.data.firstName} ${res.data.lastName} added successfully!`);
    } catch (err) {
      console.error("Create error:", err);
      toast.error(err.response?.data?.error || "Failed to add employee");
    } finally { setLoading(false); }
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    if (!q) return true;
    return `${e.firstName} ${e.lastName} ${e.jobTitle} ${e.employeeNumber}`.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title="Employees" actions={
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Employee</button>
      } />

      <div className="page-content">
        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div className="search-wrap">
            <span className="search-icon" style={{ fontSize: 12 }}>🔍</span>
            <input className="search-input" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{filtered.length} employees</span>
            <button className="btn btn-sm">Export CSV</button>
          </div>
        </div>

        {/* Employees table */}
        <div className="card" style={{ marginBottom: 16 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-title">No employees found</div>
              <div className="empty-desc">Add your first employee to get started</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Contract</th>
                    <th>Gross Salary</th>
                    <th>Start Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id} onClick={() => setSelected(emp)} style={{ cursor: "pointer" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="avatar" style={{ background: getAvatarColor(`${emp.firstName} ${emp.lastName}`) }}>
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{emp.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{emp.department?.name || "—"}</td>
                      <td>{emp.jobTitle}</td>
                      <td><span className={`badge ${getStatusBadge(emp.contractType)}`}>{emp.contractType}</span></td>
                      <td style={{ fontWeight: 500 }}>{fmtUSD(emp.basicSalary)} <span style={{ fontSize: 10, color: "var(--muted)" }}>{emp.currency}</span></td>
                      <td style={{ color: "var(--muted)" }}>{emp.startDate ? new Date(emp.startDate).toLocaleDateString() : "—"}</td>
                      <td><span className={`badge ${getStatusBadge(emp.employmentStatus)}`}>{emp.employmentStatus}</span></td>
                      <td><button className="btn btn-sm" onClick={e => { e.stopPropagation(); setSelected(emp); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Employee detail panel */}
        {selected && (
          <div className="card animate-fadeUp">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border2)" }}>
              <div className="avatar avatar-lg" style={{ background: getAvatarColor(`${selected.firstName} ${selected.lastName}`) }}>
                {getInitials(selected.firstName, selected.lastName)}
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700 }}>{selected.firstName} {selected.lastName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selected.jobTitle} · {selected.department?.name || "No dept"} · {selected.employeeNumber}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className={`badge ${getStatusBadge(selected.employmentStatus)}`}>{selected.employmentStatus}</span>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { label: "Gender", value: selected.gender || "—" },
                { label: "National ID", value: selected.nationalId || "—" },
                { label: "ZIMRA Tax No", value: selected.taxNumber || "—" },
                { label: "NSSA Number", value: selected.nssaNumber || "—" },
                { label: "Gross Salary", value: `${fmtUSD(selected.basicSalary)} ${selected.currency}`, gold: true },
                { label: "Contract Type", value: selected.contractType },
                { label: "Payment Method", value: selected.paymentMethod },
                { label: "Bank", value: selected.bankName ? `${selected.bankName} · ${selected.bankAccount || ""}` : "—" },
                { label: "Start Date", value: selected.startDate ? new Date(selected.startDate).toLocaleDateString() : "—" },
                { label: "Date of Birth", value: selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : "—" },
                { label: "Phone", value: selected.phone || "—" },
                { label: "Email", value: selected.email || "—" },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: item.gold ? "var(--gold)" : "var(--text)" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <div className="modal-title">Add New Employee</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              {/* Personal Information */}
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>
                Personal Information
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-input" value={form.firstName} onChange={setF("firstName")} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-input" value={form.lastName} onChange={setF("lastName")} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">National ID</label>
                  <input className="form-input" placeholder="63-123456X00" value={form.nationalId} onChange={setF("nationalId")} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input className="form-input" type="date" value={form.dateOfBirth} onChange={setF("dateOfBirth")} />
                </div>
              </div>
              
              {/* ✅ GENDER DROPDOWN ADDED HERE */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender} onChange={setF("gender")}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={setF("email")} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+263 77 123 4567" value={form.phone} onChange={setF("phone")} />
                </div>
              </div>

              {/* Employment Details */}
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 12px", fontWeight: 600 }}>
                Employment Details
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Job Title *</label>
                  <input className="form-input" value={form.jobTitle} onChange={setF("jobTitle")} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select className="form-select" value={form.departmentId} onChange={setF("departmentId")} style={{ flex: 1 }}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-sm" onClick={() => setShowDeptModal(true)} style={{ whiteSpace: "nowrap" }}>
                      + New
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contract Type *</label>
                  <select className="form-select" value={form.contractType} onChange={setF("contractType")}>
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" value={form.startDate} onChange={setF("startDate")} required />
                </div>
              </div>

              {/* Salary & Payment */}
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 12px", fontWeight: 600 }}>
                Salary & Payment
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Basic Salary *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.basicSalary} onChange={setF("basicSalary")} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency} onChange={setF("currency")}>
                    <option value="USD">USD</option>
                    <option value="ZiG">ZiG</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={form.paymentMethod} onChange={setF("paymentMethod")}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
              {form.paymentMethod === "BANK_TRANSFER" && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <select className="form-select" value={form.bankName} onChange={setF("bankName")}>
                      <option value="">Select Bank</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <input className="form-input" value={form.bankAccount} onChange={setF("bankAccount")} />
                  </div>
                </div>
              )}
              {form.paymentMethod === "ECOCASH" && (
                <div className="form-group">
                  <label className="form-label">EcoCash Number</label>
                  <input className="form-input" placeholder="077 123 4567" value={form.ecocashNumber} onChange={setF("ecocashNumber")} />
                </div>
              )}

              {/* Compliance Numbers */}
              <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 12px", fontWeight: 600 }}>
                Compliance Numbers
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ZIMRA Tax Number</label>
                  <input className="form-input" placeholder="2012345678" value={form.taxNumber} onChange={setF("taxNumber")} />
                </div>
                <div className="form-group">
                  <label className="form-label">NSSA Number</label>
                  <input className="form-input" placeholder="NS-887623" value={form.nssaNumber} onChange={setF("nssaNumber")} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: "center", padding: 11 }}>
                  {loading ? "Adding…" : "Add Employee"}
                </button>
                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: "center", padding: 11 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Create Department</div>
              <button className="btn btn-sm" onClick={() => setShowDeptModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDepartment}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input className="form-input" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="e.g., Human Resources" autoFocus />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
                <button type="button" className="btn" onClick={() => setShowDeptModal(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

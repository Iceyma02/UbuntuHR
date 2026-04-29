import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zimhr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("zimhr_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──
export const login    = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const getMe    = ()     => api.get("/auth/me");

// ── Employees ──
export const getEmployees   = (params) => api.get("/employees", { params });
export const getEmployee    = (id)     => api.get(`/employees/${id}`);
export const createEmployee = (data)   => api.post("/employees", data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const terminateEmployee = (id, data) => api.post(`/employees/${id}/terminate`, data);
export const getDepartments = ()       => api.get("/employees/meta/departments");
export const createDepartment = (data) => api.post("/employees/meta/departments", data);

// ── Payroll ──
export const getPayrollRuns    = ()          => api.get("/payroll/runs");
export const getPayrollRun     = (id)        => api.get(`/payroll/runs/${id}`);
export const calculatePayroll  = (data)      => api.post("/payroll/calculate", data);
export const createPayrollRun  = (data)      => api.post("/payroll/runs", data);
export const lockPayrollRun    = (id)        => api.post(`/payroll/runs/${id}/lock`);
export const exportBankFile    = (id, bank)  => api.get(`/payroll/runs/${id}/export/${bank}`, { responseType: "blob" });

// ── Leave ──
export const getLeaveRequests  = (params)    => api.get("/leave/requests", { params });
export const createLeaveRequest = (data)     => api.post("/leave/requests", data);
export const actionLeaveRequest = (id, action, data) => api.post(`/leave/requests/${id}/${action}`, data);
export const getLeaveBalances  = (empId)     => api.get(`/leave/balances/${empId}`);
export const getLeaveLiability = ()          => api.get("/leave/liability");
export const getLeaveTypes     = ()          => api.get("/leave/types");
export const getPublicHolidays = (year)      => api.get("/leave/holidays", { params: { year } });

// ── Compliance ──
export const getCompliance      = ()          => api.get("/compliance");
export const getTaxTables       = (year)      => api.get("/compliance/tax-tables", { params: { year } });
export const generatePayeReturn = (period)    => api.get(`/compliance/paye-return/${period}`, { responseType: "blob" });
export const generateNssaReturn = (period)    => api.get(`/compliance/nssa-return/${period}`, { responseType: "blob" });
export const calculatePenalty   = (data)      => api.post("/compliance/penalty", data);
export const fileCompliance     = (id, data)  => api.post(`/compliance/${id}/file`, data);

// ── Payslips ──
export const getPayslipsByRun   = (runId)     => api.get(`/payslips/run/${runId}`);
export const getEmployeePayslips = (empId)    => api.get(`/payslips/employee/${empId}`);
export const generatePayslipHtml = (runId, empId) => api.get(`/payslips/generate/${runId}/${empId}`);
export const bulkGeneratePayslips = (runId)   => api.post(`/payslips/bulk-generate/${runId}`);

// ── Analytics ──
export const getAnalyticsDashboard = () => api.get("/analytics/dashboard");
export const getLeaveUtilization   = () => api.get("/analytics/leave-utilization");

// ── Company ──
export const getCompany    = () => api.get("/company");
export const updateCompany = (data) => api.put("/company", data);

export default api;

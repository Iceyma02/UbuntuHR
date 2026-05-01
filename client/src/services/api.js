import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "https://ubuntu-hr.vercel.app/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
export const register = (data) => api.post("/auth/register", data);
export const login = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");

// ─────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────
export const getEmployees = (params) => api.get("/employees", { params });
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const createEmployee = (data) => api.post("/employees", data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const terminateEmployee = (id, data) => api.post(`/employees/${id}/terminate`, data);
export const getDepartments = () => api.get("/employees/meta/departments");
export const createDepartment = (data) => api.post("/employees/meta/departments", data);

// ─────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────
export const getPayrollRuns = () => api.get("/payroll");
export const createPayrollRun = (data) => api.post("/payroll", data);
export const getPayrollRun = (id) => api.get(`/payroll/${id}`);
export const lockPayrollRun = (id) => api.post(`/payroll/${id}/lock`);
export const processPayroll = (data) => api.post("/payroll/process", data);
export const calculatePayroll = (data) => api.post("/payroll/calculate", data);
export const getPayrollItems = (runId) => api.get(`/payroll/${runId}/items`);
export const updatePayrollItem = (runId, empId, data) => api.put(`/payroll/${runId}/items/${empId}`, data);

// ─────────────────────────────────────────
// LEAVE
// ─────────────────────────────────────────
export const getLeaveRequests = () => api.get("/leave");
export const createLeaveRequest = (data) => api.post("/leave", data);
export const actionLeaveRequest = (id, action) => api.put(`/leave/${id}/${action}`);
export const getLeaveTypes = () => api.get("/leave/types");
export const getLeaveBalances = () => api.get("/leave/balances");
export const getLeaveLiability = () => api.get("/leave/liability");
export const getPublicHolidays = (year) => api.get(`/leave/holidays?year=${year}`);

// ─────────────────────────────────────────
// COMPLIANCE
// ─────────────────────────────────────────
export const getCompliance = () => api.get("/compliance");
export const getTaxTables = () => api.get("/compliance/tax-tables");
export const generatePayeReturn = (period) => api.get(`/compliance/paye-return/${period}`, { responseType: "blob" });
export const generateNssaReturn = (period) => api.get(`/compliance/nssa-return/${period}`, { responseType: "blob" });
export const calculatePenalty = (data) => api.post("/compliance/penalty", data);
export const fileCompliance = (id, data) => api.post(`/compliance/${id}/file`, data);

// ─────────────────────────────────────────
// PAYSLIPS
// ─────────────────────────────────────────
export const getPayslips = (runId) => api.get(`/payslips/${runId}`);
export const generatePayslip = (runId, empId) => api.post(`/payslips/${runId}/${empId}`, {}, { responseType: "blob" });
export const bulkGeneratePayslips = (runId) => api.post(`/payslips/bulk/${runId}`);
export const generatePayslipHtml = (runId, empId) => api.get(`/payslips/preview/${runId}/${empId}`);
export const sendWhatsappPayslip = (runId, empId) => api.post(`/payslips/${runId}/${empId}/whatsapp`);
export const sendEmailPayslip = (runId, empId) => api.post(`/payslips/${runId}/${empId}/email`);

// ─────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────
export const getAnalyticsDashboard = () => api.get("/analytics/dashboard");
export const getLeaveUtilization = () => api.get("/analytics/leave-utilization");
export const getPayrollForecast = () => api.get("/analytics/forecast");

export default api;

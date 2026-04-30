const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const authRoutes       = require("../server/routes/auth");
const employeeRoutes   = require("../server/routes/employees");
const payrollRoutes    = require("../server/routes/payroll");
const leaveRoutes      = require("../server/routes/leave");
const complianceRoutes = require("../server/routes/compliance");
const payslipRoutes    = require("../server/routes/payslips");
const analyticsRoutes  = require("../server/routes/analytics");
const companyRoutes    = require("../server/routes/company");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth",       authRoutes);
app.use("/api/employees",  employeeRoutes);
app.use("/api/payroll",    payrollRoutes);
app.use("/api/leave",      leaveRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/payslips",   payslipRoutes);
app.use("/api/analytics",  analyticsRoutes);
app.use("/api/company",    companyRoutes);

app.get("/api/health", (_, res) => res.json({ status: "UbuntuHR API running ✓" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// Vercel needs module.exports = app
module.exports = app;

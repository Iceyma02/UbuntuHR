const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes       = require("./routes/auth");
const employeeRoutes   = require("./routes/employees");
const payrollRoutes    = require("./routes/payroll");
const leaveRoutes      = require("./routes/leave");
const complianceRoutes = require("./routes/compliance");
const payslipRoutes    = require("./routes/payslips");
const analyticsRoutes  = require("./routes/analytics");
const companyRoutes    = require("./routes/company");

const app = express();

// ── Security ──
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));

// ── Rate limiting ──
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ── Body parser ──
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
app.use("/api/auth",       authRoutes);
app.use("/api/employees",  employeeRoutes);
app.use("/api/payroll",    payrollRoutes);
app.use("/api/leave",      leaveRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/payslips",   payslipRoutes);
app.use("/api/analytics",  analyticsRoutes);
app.use("/api/company",    companyRoutes);

// ── Health check ──
app.get("/health", (_, res) => res.json({ status: "ZimHR API running", version: "1.0.0" }));

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ZimHR Server running on port ${PORT}`));

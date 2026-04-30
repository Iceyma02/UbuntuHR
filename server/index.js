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

// ── Request logging (for debugging) ──
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
app.get("/api/health", (_, res) => res.json({ status: "UbuntuHR API running ✓", version: "1.0.0" }));

// ── Database test endpoint ──
app.get("/api/test-db", async (req, res) => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const companyCount = await prisma.company.count();
    res.json({ 
      success: true, 
      message: "Database connected successfully!",
      userCount,
      companyCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ── Root endpoint ──
app.get("/", (_, res) => res.json({ message: "UbuntuHR API is running" }));

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 UbuntuHR Server running on port ${PORT}`));

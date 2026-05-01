const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── Analytics dashboard ──
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    // Employee stats
    const employees = await prisma.employee.findMany({
      where: { companyId },
      include: { department: true },
    });
    
    const activeEmployees = employees.filter(e => e.employmentStatus === "ACTIVE");
    
    // Payroll runs
    const payrollRuns = await prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: { period: "desc" },
      take: 12,
      include: { items: true },
    });
    
    // Payroll trend
    const payrollTrend = payrollRuns.reverse().map(run => ({
      period: run.period,
      gross: run.totalGross,
      net: run.totalNet,
      paye: run.totalPaye,
    }));
    
    // Current month payroll
    const currentMonth = payrollRuns[0] || { totalGross: 0, totalNet: 0 };
    
    // Department stats
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: { employees: true },
    });
    
    const deptStats = departments.map(dept => ({
      name: dept.name,
      headcount: dept.employees.length,
      totalSalary: dept.employees.reduce((sum, e) => sum + (e.basicSalary || 0), 0),
    }));
    
    // ZIMRA liability
    const zimraLiability = payrollRuns.reduce((sum, run) => sum + run.totalPaye, 0);
    
    // Compliance logs
    const complianceLogs = await prisma.complianceLog.findMany({
      where: { companyId, status: { in: ["PENDING", "OVERDUE"] } },
    });
    
    // Forecast next 3 months
    const lastRun = payrollRuns[0];
    const forecast = [];
    const dueDate = new Date();
    
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + i);
      forecast.push({
        period: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`,
        estimatedPaye: lastRun?.totalPaye || 0,
        dueDate: new Date(nextDate.getFullYear(), nextDate.getMonth(), 10),
      });
    }
    
    res.json({
      summary: {
        totalEmployees: employees.length,
        activeEmployees: activeEmployees.length,
        currentMonthPayroll: currentMonth.totalGross,
        currentMonthNet: currentMonth.totalNet,
        zimraLiability,
        pendingLeave: 0,
      },
      payrollTrend,
      deptStats,
      complianceLogs,
      forecast,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Leave utilization ──
router.get("/leave-utilization", async (req, res) => {
  try {
    const balances = await prisma.leaveBalance.findMany({
      where: { employee: { companyId: req.user.companyId }, year: new Date().getFullYear() },
      include: { leaveType: true },
    });
    
    const utilization = {};
    balances.forEach(b => {
      if (!utilization[b.leaveType.name]) {
        utilization[b.leaveType.name] = { entitled: 0, used: 0 };
      }
      utilization[b.leaveType.name].entitled += b.entitled;
      utilization[b.leaveType.name].used += b.used;
    });
    
    const result = Object.entries(utilization).map(([type, data]) => ({
      type,
      entitled: data.entitled,
      used: data.used,
      utilizationPct: data.entitled > 0 ? Math.round((data.used / data.entitled) * 100) : 0,
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Payroll forecast ──
router.get("/forecast", async (req, res) => {
  try {
    const lastRun = await prisma.payrollRun.findFirst({
      where: { companyId: req.user.companyId },
      orderBy: { period: "desc" },
    });
    
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      forecast.push({
        period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        estimatedPaye: lastRun?.totalPaye || 0,
        dueDate: new Date(date.getFullYear(), date.getMonth(), 10),
      });
    }
    
    res.json(forecast);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

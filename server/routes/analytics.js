const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── Main analytics dashboard ──
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [
      totalEmployees,
      activeEmployees,
      departments,
      recentRuns,
      pendingLeave,
      complianceLogs,
    ] = await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, employmentStatus: "ACTIVE" } }),
      prisma.department.findMany({
        where: { companyId },
        include: {
          _count: { select: { employees: true } },
          employees: { select: { basicSalary: true, employmentStatus: true } },
        },
      }),
      prisma.payrollRun.findMany({
        where: { companyId },
        orderBy: { period: "desc" },
        take: 12,
      }),
      prisma.leaveRequest.count({
        where: { employee: { companyId }, status: "PENDING" },
      }),
      prisma.complianceLog.findMany({
        where: { companyId, status: { in: ["PENDING", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Department breakdown
    const deptStats = departments.map(d => ({
      name: d.name,
      headcount: d._count.employees,
      totalSalary: d.employees
        .filter(e => e.employmentStatus === "ACTIVE")
        .reduce((s, e) => s + e.basicSalary, 0),
    }));

    // Payroll trend (last 12 months)
    const payrollTrend = recentRuns.map(r => ({
      period: r.period,
      gross: r.totalGross,
      net: r.totalNet,
      paye: r.totalPaye,
      nssa: r.totalNssa,
    }));

    // Current month stats
    const currentRun = recentRuns.find(r => r.period === `${currentYear}-${String(currentMonth).padStart(2, "0")}`);

    // ZIMRA forecast (next 3 months)
    const avgPaye = recentRuns.length > 0
      ? recentRuns.slice(0, 3).reduce((s, r) => s + r.totalPaye, 0) / Math.min(3, recentRuns.length)
      : 0;

    const forecast = [1, 2, 3].map(i => {
      const m = ((currentMonth - 1 + i) % 12) + 1;
      const y = currentYear + Math.floor((currentMonth - 1 + i) / 12);
      return {
        period: `${y}-${String(m).padStart(2, "0")}`,
        estimatedPaye: Math.round(avgPaye * 100) / 100,
        dueDate: `${y}-${String(m + 1 > 12 ? 1 : m + 1).padStart(2, "0")}-10`,
      };
    });

    res.json({
      summary: {
        totalEmployees,
        activeEmployees,
        pendingLeave,
        currentMonthPayroll: currentRun?.totalGross || 0,
        currentMonthNet: currentRun?.totalNet || 0,
        zimraLiability: complianceLogs.filter(c => c.type === "PAYE").reduce((s, c) => s + (c.amount || 0), 0),
      },
      deptStats,
      payrollTrend,
      complianceLogs,
      forecast,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Headcount over time ──
router.get("/headcount", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: req.user.companyId },
      select: { startDate: true, terminationDate: true, employmentStatus: true },
      orderBy: { startDate: "asc" },
    });

    res.json({ employees: employees.length, data: employees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Leave utilization ──
router.get("/leave-utilization", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { employee: { companyId: req.user.companyId }, year },
      include: { leaveType: true },
    });

    const byType = {};
    for (const b of balances) {
      const key = b.leaveType.name;
      if (!byType[key]) byType[key] = { entitled: 0, used: 0 };
      byType[key].entitled += b.entitled;
      byType[key].used += b.used;
    }

    const result = Object.entries(byType).map(([type, v]) => ({
      type,
      entitled: v.entitled,
      used: v.used,
      utilizationPct: v.entitled > 0 ? Math.round((v.used / v.entitled) * 100) : 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── GET leave requests ──
router.get("/requests", async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const where = {
      employee: { companyId: req.user.companyId },
      ...(status && { status }),
      ...(employeeId && { employeeId }),
    };

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true } },
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE leave request ──
router.post("/requests", async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;

    // Calculate working days (exclude weekends + public holidays)
    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalDays = 0;
    const holidays = await prisma.publicHoliday.findMany({
      where: { companyId: req.user.companyId, year: start.getFullYear() },
    });
    const holidayDates = holidays.map(h => h.date.toISOString().split("T")[0]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const ds = d.toISOString().split("T")[0];
      if (dow !== 0 && dow !== 6 && !holidayDates.includes(ds)) totalDays++;
    }

    // Check balance
    const year = start.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });

    if (!balance) return res.status(400).json({ error: "No leave balance found" });
    if (balance.remaining < totalDays) return res.status(400).json({ error: `Insufficient leave. ${balance.remaining} days available, ${totalDays} requested` });

    const request = await prisma.$transaction(async (tx) => {
      const req_ = await tx.leaveRequest.create({
        data: { employeeId, leaveTypeId, startDate: start, endDate: end, totalDays, reason, status: "PENDING" },
        include: { employee: true, leaveType: true },
      });

      // Reserve days as pending
      await tx.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
        data: { pending: { increment: totalDays }, remaining: { decrement: totalDays } },
      });

      return req_;
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── APPROVE / REJECT leave ──
router.post("/requests/:id/:action", requireRole("COMPANY_ADMIN", "HR_MANAGER", "MANAGER"), async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });

    const request = await prisma.leaveRequest.findUnique({
      where: { id }, include: { leaveType: true },
    });
    if (!request || request.status !== "PENDING") return res.status(400).json({ error: "Request not found or already actioned" });

    const year = request.startDate.getFullYear();

    const updated = await prisma.$transaction(async (tx) => {
      const status = action === "approve" ? "APPROVED" : "REJECTED";

      const upd = await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          ...(action === "approve"
            ? { approvedBy: req.user.id, approvedAt: new Date() }
            : { rejectedBy: req.user.id, rejectedAt: new Date(), rejectReason: req.body.reason }),
        },
      });

      if (action === "approve") {
        // Move from pending to used
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } },
          data: { pending: { decrement: request.totalDays }, used: { increment: request.totalDays } },
        });
      } else {
        // Restore balance
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } },
          data: { pending: { decrement: request.totalDays }, remaining: { increment: request.totalDays } },
        });
      }

      return upd;
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET leave balances for employee ──
router.get("/balances/:employeeId", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId: req.params.employeeId, year },
      include: { leaveType: true },
    });
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET leave liability report ──
router.get("/liability", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const employees = await prisma.employee.findMany({
      where: { companyId: req.user.companyId, employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
      include: {
        leaveBalances: {
          where: { year },
          include: { leaveType: { where: { code: "AL" } } },
        },
      },
    });

    const report = employees.map(emp => {
      const annualLeave = emp.leaveBalances.find(b => b.leaveType?.code === "AL");
      const unused = annualLeave?.remaining || 0;
      const dailyRate = emp.basicSalary / 22;
      const cashValue = Math.round(unused * dailyRate * 100) / 100;
      return {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        basicSalary: emp.basicSalary,
        entitled: annualLeave?.entitled || 30,
        used: annualLeave?.used || 0,
        remaining: unused,
        cashValue,
        risk: cashValue > 1500 ? "HIGH" : cashValue > 500 ? "MEDIUM" : "LOW",
      };
    });

    const totalLiability = report.reduce((s, r) => s + r.cashValue, 0);
    res.json({ report, totalLiability: Math.round(totalLiability * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET leave types ──
router.get("/types", async (req, res) => {
  const types = await prisma.leaveType.findMany({
    where: { companyId: req.user.companyId, isActive: true },
  });
  res.json(types);
});

// ── GET public holidays ──
router.get("/holidays", async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const holidays = await prisma.publicHoliday.findMany({
    where: { companyId: req.user.companyId, year },
    orderBy: { date: "asc" },
  });
  res.json(holidays);
});

module.exports = router;

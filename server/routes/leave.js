const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── Get all leave requests ──
router.get("/", async (req, res) => {
  try {
    const where = { employee: { companyId: req.user.companyId } };
    if (req.user.role === "EMPLOYEE") {
      where.employeeId = req.user.id;
    }
    
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { employee: true, leaveType: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create leave request ──
router.post("/", async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: employeeId || req.user.id,
        leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason,
        status: req.user.role === "EMPLOYEE" ? "PENDING" : "APPROVED",
      },
      include: { employee: true, leaveType: true },
    });
    
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Approve/Reject leave ──
router.put("/:id/:action", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const { id, action } = req.params;
    const status = action === "approve" ? "APPROVED" : "REJECTED";
    
    const request = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
    });
    
    // Update leave balance if approved
    if (status === "APPROVED") {
      const year = new Date().getFullYear();
      await prisma.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year },
        data: { used: { increment: request.totalDays }, remaining: { decrement: request.totalDays } },
      });
    }
    
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get leave types ──
router.get("/types", async (req, res) => {
  try {
    const types = await prisma.leaveType.findMany({
      where: { companyId: req.user.companyId, isActive: true },
    });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get leave balances ──
router.get("/balances", async (req, res) => {
  try {
    const balances = await prisma.leaveBalance.findMany({
      where: { employee: { companyId: req.user.companyId }, year: new Date().getFullYear() },
      include: { employee: true, leaveType: true },
    });
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get leave liability report ──
router.get("/liability", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: req.user.companyId, employmentStatus: "ACTIVE" },
      include: { leaveBalances: { where: { year: new Date().getFullYear() }, include: { leaveType: true } } },
    });
    
    let totalLiability = 0;
    const report = employees.map(emp => {
      let remaining = 0;
      let cashValue = 0;
      
      emp.leaveBalances.forEach(b => {
        if (b.leaveType.isPaid) {
          remaining += b.remaining;
          cashValue += b.remaining * (emp.basicSalary / 30);
        }
      });
      
      totalLiability += cashValue;
      
      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        basicSalary: emp.basicSalary,
        entitled: emp.leaveBalances.reduce((s, b) => s + b.entitled, 0),
        used: emp.leaveBalances.reduce((s, b) => s + b.used, 0),
        remaining,
        cashValue,
        risk: cashValue > emp.basicSalary * 2 ? "HIGH" : cashValue > emp.basicSalary ? "MEDIUM" : "LOW",
      };
    });
    
    res.json({ totalLiability, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get public holidays ──
router.get("/holidays", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await prisma.publicHoliday.findMany({
      where: { companyId: req.user.companyId, year },
      orderBy: { date: "asc" },
    });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

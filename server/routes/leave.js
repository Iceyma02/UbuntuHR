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

// ── Create leave request (FIXED - Always PENDING) ──
router.post("/", async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;
    
    // Validate required fields
    if (!leaveTypeId || !startDate || !endDate) {
      return res.status(400).json({ error: "Leave type, start date, and end date are required" });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    
    // Calculate total days
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    if (totalDays < 1) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
    
    // Check if employee exists
    const targetEmployeeId = employeeId || req.user.id;
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
    });
    
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    // Create leave request with PENDING status
    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: targetEmployeeId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: reason || null,
        status: "PENDING", // ✅ ALWAYS pending for approval
      },
      include: { employee: true, leaveType: true },
    });
    
    res.status(201).json(request);
  } catch (err) {
    console.error("Leave creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Approve/Reject leave request ──
router.put("/:id/:action", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    }
    
    const status = action === "approve" ? "APPROVED" : "REJECTED";
    
    // Get the request first to check if it exists
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    
    if (!existingRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    
    // Update the request
    const request = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      include: { employee: true, leaveType: true },
    });
    
    // If approved, update leave balance
    if (status === "APPROVED") {
      const year = new Date().getFullYear();
      
      // Check if balance exists
      const existingBalance = await prisma.leaveBalance.findFirst({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      });
      
      if (existingBalance) {
        await prisma.leaveBalance.update({
          where: { id: existingBalance.id },
          data: {
            used: { increment: request.totalDays },
            remaining: { decrement: request.totalDays },
          },
        });
      }
    }
    
    res.json(request);
  } catch (err) {
    console.error("Leave action error:", err);
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

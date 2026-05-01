const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ─────────────────────────────────────────
// LEAVE REQUESTS (Main endpoints)
// ─────────────────────────────────────────

// GET all leave requests (no /requests prefix)
router.get("/", async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const where = {
      employee: { companyId: req.user.companyId },
      ...(status && { status }),
      ...(employeeId && { employeeId }),
    };
    
    // If user is EMPLOYEE, only show their own requests
    if (req.user.role === "EMPLOYEE") {
      where.employeeId = req.user.id;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            employeeNumber: true, 
            department: true 
          } 
        },
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    console.error("GET leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE leave request
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

    // Calculate total days (excluding weekends)
    let totalDays = 0;
    const holidays = await prisma.publicHoliday.findMany({
      where: { companyId: req.user.companyId, year: start.getFullYear() },
    });
    const holidayDates = holidays.map(h => h.date.toISOString().split("T")[0]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const ds = d.toISOString().split("T")[0];
      if (dow !== 0 && dow !== 6 && !holidayDates.includes(ds)) {
        totalDays++;
      }
    }

    if (totalDays < 1) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Determine employee ID
    const targetEmployeeId = employeeId || req.user.id;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId, companyId: req.user.companyId },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check balance
    const year = start.getFullYear();
    const balance = await prisma.leaveBalance.findFirst({
      where: { 
        employeeId: targetEmployeeId, 
        leaveTypeId, 
        year 
      },
    });

    if (!balance) {
      return res.status(400).json({ error: "No leave balance found for this leave type" });
    }
    if (balance.remaining < totalDays) {
      return res.status(400).json({ 
        error: `Insufficient leave. ${balance.remaining} days available, ${totalDays} requested` 
      });
    }

    // Create request with transaction
    const request = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.leaveRequest.create({
        data: { 
          employeeId: targetEmployeeId, 
          leaveTypeId, 
          startDate: start, 
          endDate: end, 
          totalDays, 
          reason: reason || null, 
          status: "PENDING" 
        },
        include: { employee: true, leaveType: true },
      });

      // Reserve pending days
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { 
          pending: { increment: totalDays }, 
          remaining: { decrement: totalDays } 
        },
      });

      return newRequest;
    });

    res.status(201).json(request);
  } catch (err) {
    console.error("Create leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

// APPROVE / REJECT leave request
router.put("/:id/:action", requireRole("COMPANY_ADMIN", "HR_MANAGER", "MANAGER"), async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id }, 
      include: { leaveType: true },
    });
    
    if (!request) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Request already processed" });
    }

    const year = request.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findFirst({
      where: { 
        employeeId: request.employeeId, 
        leaveTypeId: request.leaveTypeId, 
        year 
      },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const status = action === "approve" ? "APPROVED" : "REJECTED";

      const updatedRequest = await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          ...(action === "approve"
            ? { approvedBy: req.user.id, approvedAt: new Date() }
            : { rejectedBy: req.user.id, rejectedAt: new Date(), rejectReason: req.body.reason || "No reason provided" }),
        },
      });

      if (action === "approve") {
        // Move from pending to used
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { 
            pending: { decrement: request.totalDays }, 
            used: { increment: request.totalDays } 
          },
        });
      } else {
        // Restore balance for rejection
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { 
            pending: { decrement: request.totalDays }, 
            remaining: { increment: request.totalDays } 
          },
        });
      }

      return updatedRequest;
    });

    res.json(updated);
  } catch (err) {
    console.error("Leave action error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// LEAVE LIABILITY REPORT
// ─────────────────────────────────────────

router.get("/liability", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const employees = await prisma.employee.findMany({
      where: { 
        companyId: req.user.companyId, 
        employmentStatus: { in: ["ACTIVE", "PROBATION"] } 
      },
      include: {
        leaveBalances: {
          where: { year },
          include: { leaveType: true },
        },
      },
    });

    const report = [];
    let totalLiability = 0;

    for (const emp of employees) {
      // Get annual leave balance (AL)
      const annualLeaveBalance = emp.leaveBalances.find(b => b.leaveType?.code === "AL") || 
                                  emp.leaveBalances.find(b => b.leaveType?.name?.toLowerCase().includes("annual"));
      
      // Get all paid leave balances
      const paidLeaveBalances = emp.leaveBalances.filter(b => b.leaveType?.isPaid === true);
      
      let totalRemainingDays = 0;
      let totalCashValue = 0;
      let totalEntitled = 0;
      let totalUsed = 0;

      // Calculate for annual leave specifically (used for liability)
      if (annualLeaveBalance) {
        const remaining = annualLeaveBalance.remaining;
        const dailyRate = emp.basicSalary / 22; // Working days per month
        const cashValue = Math.round(remaining * dailyRate * 100) / 100;
        
        totalRemainingDays = remaining;
        totalCashValue = cashValue;
        totalEntitled = annualLeaveBalance.entitled || 30;
        totalUsed = annualLeaveBalance.used || 0;
        totalLiability += cashValue;
      } else if (paidLeaveBalances.length > 0) {
        // Fallback: sum all paid leave balances
        for (const balance of paidLeaveBalances) {
          totalRemainingDays += balance.remaining;
          const dailyRate = emp.basicSalary / 22;
          totalCashValue += Math.round(balance.remaining * dailyRate * 100) / 100;
          totalEntitled += balance.entitled;
          totalUsed += balance.used;
          totalLiability += Math.round(balance.remaining * dailyRate * 100) / 100;
        }
      }

      // Determine risk level
      let risk = "LOW";
      if (totalCashValue > emp.basicSalary * 2) {
        risk = "HIGH";
      } else if (totalCashValue > emp.basicSalary) {
        risk = "MEDIUM";
      }

      report.push({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        basicSalary: emp.basicSalary,
        entitled: totalEntitled || 30,
        used: totalUsed || 0,
        remaining: totalRemainingDays,
        cashValue: totalCashValue,
        risk,
      });
    }

    // Sort by risk (HIGH first)
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    report.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

    res.json({ 
      report, 
      totalLiability: Math.round(totalLiability * 100) / 100 
    });
  } catch (err) {
    console.error("Liability report error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// LEAVE TYPES
// ─────────────────────────────────────────

router.get("/types", async (req, res) => {
  try {
    const types = await prisma.leaveType.findMany({
      where: { companyId: req.user.companyId, isActive: true },
    });
    res.json(types);
  } catch (err) {
    console.error("Get leave types error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// LEAVE BALANCES
// ─────────────────────────────────────────

router.get("/balances", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const employeeId = req.query.employeeId || req.user.id;
    
    const balances = await prisma.leaveBalance.findMany({
      where: { 
        employeeId, 
        year,
        employee: { companyId: req.user.companyId }
      },
      include: { leaveType: true },
    });
    res.json(balances);
  } catch (err) {
    console.error("Get balances error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PUBLIC HOLIDAYS
// ─────────────────────────────────────────

router.get("/holidays", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await prisma.publicHoliday.findMany({
      where: { companyId: req.user.companyId, year },
      orderBy: { date: "asc" },
    });
    res.json(holidays);
  } catch (err) {
    console.error("Get holidays error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

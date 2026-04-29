const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");
const { calculateEmployeePayroll, processBulkPayroll } = require("../utils/payeCalculator");

const prisma = new PrismaClient();
router.use(protect);

// ── GET all payroll runs ──
router.get("/runs", async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { period: "desc" },
      take: 24,
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single run with items ──
router.get("/runs/:id", async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: {
        items: {
          include: { employee: { include: { department: true } } },
          orderBy: { employee: { lastName: "asc" } },
        },
      },
    });
    if (!run) return res.status(404).json({ error: "Payroll run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CALCULATE single employee (preview) ──
router.post("/calculate", async (req, res) => {
  try {
    const result = calculateEmployeePayroll(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── CREATE & PROCESS payroll run ──
router.post("/runs", requireRole("COMPANY_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"), async (req, res) => {
  try {
    const { month, year, currency = "USD", overrides = {} } = req.body;
    const companyId = req.user.companyId;
    const period = `${year}-${String(month).padStart(2, "0")}`;

    // Check no duplicate run
    const existing = await prisma.payrollRun.findUnique({ where: { companyId_period: { companyId, period } } });
    if (existing) return res.status(400).json({ error: `Payroll for ${period} already exists` });

    // Fetch all active employees
    const employees = await prisma.employee.findMany({
      where: { companyId, employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
    });

    if (employees.length === 0) return res.status(400).json({ error: "No active employees found" });

    // Calculate payroll for each employee
    const payrollInputs = employees.map(emp => ({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      basicSalary: emp.basicSalary,
      currency: emp.currency || currency,
      bonus:        overrides[emp.id]?.bonus || 0,
      commission:   overrides[emp.id]?.commission || 0,
      allowances:   overrides[emp.id]?.allowances || 0,
      overtimeHours: overrides[emp.id]?.overtimeHours || 0,
    }));

    const { results, totals, employeeCount } = processBulkPayroll(payrollInputs);

    // Save to DB in one transaction
    const run = await prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          companyId, period, month, year, currency,
          status: "DRAFT",
          totalGross:    totals.totalGross,
          totalPaye:     totals.totalPaye,
          totalNssa:     totals.totalNssa,
          totalZimdef:   totals.totalZimdef,
          totalNet:      totals.totalNet,
          employeeCount,
        },
      });

      await tx.payrollItem.createMany({
        data: results.map(r => ({
          payrollRunId: payrollRun.id,
          employeeId:   r.employeeId,
          basicSalary:  r.basicSalary,
          overtime:     r.overtimePay,
          bonus:        r.bonus,
          commission:   r.commission,
          allowances:   r.allowances,
          grossEarnings: r.grossEarnings,
          paye:          r.paye,
          aidsLevy:      r.aidsLevy,
          nssaEmployee:  r.nssaEmployee,
          zimdef:        r.zimdef,
          totalDeductions: r.totalDeductions,
          netPay:        r.netPay,
          nssaEmployer:  r.nssaEmployer,
          standardsLevy: r.standardsLevy,
          overtimeHours: r.overtimeHours,
          currency,
        })),
      });

      return payrollRun;
    });

    res.status(201).json({ run, totals, employeeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── LOCK payroll run ──
router.post("/runs/:id/lock", requireRole("COMPANY_ADMIN", "PAYROLL_OFFICER"), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.status === "LOCKED") return res.status(400).json({ error: "Already locked" });

    const locked = await prisma.payrollRun.update({
      where: { id: req.params.id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedBy: `${req.user.firstName} ${req.user.lastName}`,
      },
    });

    // Create compliance log for PAYE
    await prisma.complianceLog.create({
      data: {
        companyId: req.user.companyId,
        type: "PAYE",
        period: run.period,
        amount: run.totalPaye,
        dueDate: new Date(`${run.year}-${String(run.month + 1).padStart(2, "0")}-10`),
        status: "PENDING",
      },
    });

    res.json(locked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET bank export file ──
router.get("/runs/:id/export/:bank", requireRole("COMPANY_ADMIN", "PAYROLL_OFFICER"), async (req, res) => {
  try {
    const { id, bank } = req.params;
    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: req.user.companyId },
      include: { items: { include: { employee: true } } },
    });
    if (!run) return res.status(404).json({ error: "Run not found" });

    // Generate CSV for bank transfer
    const headers = ["Employee Number", "Employee Name", "Bank Account", "Net Pay", "Currency", "Reference"];
    const rows = run.items.map(item => [
      item.employee.employeeNumber,
      `${item.employee.firstName} ${item.employee.lastName}`,
      item.employee.bankAccount || "",
      item.netPay.toFixed(2),
      item.currency,
      `SALARY ${run.period}`,
    ]);

    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=zimhr_${bank}_${run.period}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

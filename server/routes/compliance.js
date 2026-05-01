const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── Get compliance logs ──
router.get("/", async (req, res) => {
  try {
    const logs = await prisma.complianceLog.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { dueDate: "asc" },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get tax tables ──
router.get("/tax-tables", async (req, res) => {
  try {
    const tables = await prisma.taxTable.findMany({
      where: { year: new Date().getFullYear() },
      orderBy: { lowerBand: "asc" },
    });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate PAYE return (ZIMRA format) ──
router.get("/paye-return/:period", async (req, res) => {
  try {
    const { period } = req.params;
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { companyId: req.user.companyId, period },
      include: { items: { include: { employee: true } } },
    });
    
    if (!payrollRun) return res.status(404).json({ error: "Payroll run not found" });
    
    let csv = "Employee Number,Employee Name,ZIMRA PIN,Basic Salary,PAYE Tax,NSSA,ZIMDEF,Net Pay\n";
    
    payrollRun.items.forEach(item => {
      csv += `${item.employee.employeeNumber},${item.employee.firstName} ${item.employee.lastName},${item.employee.taxNumber || ""},${item.basicSalary},${item.paye},${item.nssaEmployee},${item.zimdef},${item.netPay}\n`;
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=ZIMRA_PAYE_${period}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate NSSA return (NEC format) ──
router.get("/nssa-return/:period", async (req, res) => {
  try {
    const { period } = req.params;
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { companyId: req.user.companyId, period },
      include: { items: { include: { employee: true } } },
    });
    
    if (!payrollRun) return res.status(404).json({ error: "Payroll run not found" });
    
    let csv = "NSSA Number,Employee Name,Employee ID,Gross Earnings,NSSA Contribution\n";
    
    payrollRun.items.forEach(item => {
      csv += `${item.employee.nssaNumber || ""},${item.employee.firstName} ${item.employee.lastName},${item.employee.nationalId || ""},${item.basicSalary},${item.nssaEmployee}\n`;
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=NSSA_Return_${period}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Calculate penalty ──
router.post("/penalty", async (req, res) => {
  try {
    const { type, taxDue = 0, monthsLate = 1, employeeCount = 0 } = req.body;
    
    let basePenalty = 0;
    let interestPenalty = 0;
    
    switch (type) {
      case "PAYE":
        basePenalty = 200 + (taxDue * 0.1 * monthsLate);
        interestPenalty = taxDue * 0.01 * monthsLate;
        break;
      case "NSSA":
        basePenalty = 200 * monthsLate;
        interestPenalty = 0;
        break;
      case "P6":
        basePenalty = 30 * employeeCount * monthsLate;
        interestPenalty = 0;
        break;
      default:
        basePenalty = 200 * monthsLate;
    }
    
    const total = basePenalty + interestPenalty;
    
    res.json({ basePenalty, interestPenalty, total, monthsLate, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark compliance as filed ──
router.post("/:id/file", async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;
    
    const log = await prisma.complianceLog.update({
      where: { id },
      data: {
        status: "FILED",
        filedDate: new Date(),
        reference,
      },
    });
    
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

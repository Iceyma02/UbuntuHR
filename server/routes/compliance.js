const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");
const { calculatePenalty, USD_TAX_BANDS_2025 } = require("../utils/payeCalculator");

const prisma = new PrismaClient();
router.use(protect);

// ── GET compliance dashboard ──
router.get("/", async (req, res) => {
  try {
    const logs = await prisma.complianceLog.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { dueDate: "asc" },
      take: 20,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET tax tables ──
router.get("/tax-tables", async (req, res) => {
  const year = parseInt(req.query.year) || 2025;
  const currency = req.query.currency || "USD";

  // Return from DB or fallback to hardcoded
  const dbTables = await prisma.taxTable.findMany({ where: { year, currency }, orderBy: { lowerBand: "asc" } });

  if (dbTables.length > 0) return res.json(dbTables);

  // Fallback to hardcoded 2025 tables
  res.json(USD_TAX_BANDS_2025.map((b, i) => ({
    id: `band-${i}`,
    year: 2025,
    currency: "USD",
    lowerBand: b.lower,
    upperBand: b.upper,
    rate: b.rate * 100,
    taxCredit: i === 0 ? 900 : 0,
  })));
});

// ── GENERATE ZIMRA PAYE return ──
router.get("/paye-return/:period", async (req, res) => {
  try {
    const { period } = req.params;
    const companyId = req.user.companyId;

    const run = await prisma.payrollRun.findUnique({
      where: { companyId_period: { companyId, period } },
      include: {
        items: { include: { employee: true } },
        company: true,
      },
    });

    if (!run) return res.status(404).json({ error: "Payroll run not found for this period" });

    // Build PAYE return CSV (ZIMRA format)
    const company = run.company;
    const [year, month] = period.split("-");
    const headers = ["Tax Number", "Employee Name", "Gross Income", "PAYE", "AIDS Levy", "Total Tax", "Period"];
    const rows = run.items.map(item => [
      item.employee.taxNumber || "",
      `${item.employee.firstName} ${item.employee.lastName}`,
      item.grossEarnings.toFixed(2),
      item.paye.toFixed(2),
      item.aidsLevy.toFixed(2),
      (item.paye + item.aidsLevy).toFixed(2),
      period,
    ]);

    const totalPaye = run.items.reduce((s, i) => s + i.paye + i.aidsLevy, 0);

    const csvLines = [
      `ZIMRA PAYE RETURN - ${company.name}`,
      `Company Tax Number: ${company.taxNumber || "N/A"}`,
      `Period: ${month}/${year}`,
      `Total PAYE: $${totalPaye.toFixed(2)}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      headers.join(","),
      ...rows.map(r => r.join(",")),
      "",
      `TOTAL,,${run.totalGross.toFixed(2)},${run.totalPaye.toFixed(2)},,,`,
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=ZIMRA_PAYE_${period}.csv`);
    res.send(csvLines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATE NSSA return ──
router.get("/nssa-return/:period", async (req, res) => {
  try {
    const { period } = req.params;
    const companyId = req.user.companyId;

    const run = await prisma.payrollRun.findUnique({
      where: { companyId_period: { companyId, period } },
      include: { items: { include: { employee: true } }, company: true },
    });

    if (!run) return res.status(404).json({ error: "Payroll run not found" });

    // NSSA NEC format
    const headers = ["NSSA Number", "Employee Name", "Gross Salary", "Employee Contrib (3.5%)", "Employer Contrib (3.5%)", "Total"];
    const rows = run.items.map(item => [
      item.employee.nssaNumber || "",
      `${item.employee.firstName} ${item.employee.lastName}`,
      item.grossEarnings.toFixed(2),
      item.nssaEmployee.toFixed(2),
      item.nssaEmployer.toFixed(2),
      (item.nssaEmployee + item.nssaEmployer).toFixed(2),
    ]);

    const csvLines = [
      `NSSA MONTHLY RETURN - ${run.company.name}`,
      `NSSA Number: ${run.company.nssaNumber || "N/A"}`,
      `Period: ${period}`,
      `Total Contribution: $${(run.totalNssa * 2).toFixed(2)}`,
      "",
      headers.join(","),
      ...rows.map(r => r.join(",")),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=NSSA_Return_${period}.csv`);
    res.send(csvLines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Penalty calculator ──
router.post("/penalty", (req, res) => {
  const { type, taxDue, monthsLate, employeeCount } = req.body;
  const result = calculatePenalty(type, taxDue, monthsLate, employeeCount);
  res.json(result);
});

// ── Mark compliance as filed ──
router.post("/:id/file", requireRole("COMPANY_ADMIN", "PAYROLL_OFFICER"), async (req, res) => {
  try {
    const log = await prisma.complianceLog.update({
      where: { id: req.params.id },
      data: { status: "FILED", filedDate: new Date(), reference: req.body.reference },
    });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

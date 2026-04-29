const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

// ── GET payslips for a run ──
router.get("/run/:payrollRunId", async (req, res) => {
  try {
    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: req.params.payrollRunId },
      include: { employee: true },
    });
    res.json(payslips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET payslip history for an employee ──
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const payslips = await prisma.payslip.findMany({
      where: { employeeId: req.params.employeeId },
      include: { payrollRun: true },
      orderBy: { payrollRun: { period: "desc" } },
    });
    res.json(payslips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATE payslip HTML (for PDF rendering) ──
router.get("/generate/:payrollRunId/:employeeId", async (req, res) => {
  try {
    const { payrollRunId, employeeId } = req.params;

    const [item, run] = await Promise.all([
      prisma.payrollItem.findFirst({
        where: { payrollRunId, employeeId },
        include: { employee: { include: { department: true } } },
      }),
      prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: { company: true },
      }),
    ]);

    if (!item || !run) return res.status(404).json({ error: "Payslip data not found" });

    const emp = item.employee;
    const company = run.company;
    const [year, month] = run.period.split("-");
    const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "long" });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111; padding: 32px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #C9A84C; margin-bottom: 20px; }
  .company-name { font-size: 20px; font-weight: 700; color: #0D0F14; }
  .company-sub { font-size: 11px; color: #666; margin-top: 4px; }
  .payslip-badge { background: #C9A84C; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 1px; }
  .period { font-size: 13px; font-weight: 600; color: #0D0F14; margin-top: 4px; }
  .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8f7f4; padding: 14px; border-radius: 8px; margin-bottom: 20px; }
  .field label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
  .field span { font-size: 12px; color: #111; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #0D0F14; color: white; padding: 8px 10px; font-size: 10px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; text-align: left; }
  td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #eee; }
  .net-bar { background: #0D0F14; color: white; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
  .net-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.7; }
  .net-value { font-size: 24px; font-weight: 700; color: #C9A84C; }
  .footer { margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">${company.name}</div>
    <div class="company-sub">Tax No: ${company.taxNumber || "N/A"} · NSSA: ${company.nssaNumber || "N/A"} · ${company.address || "Harare, Zimbabwe"}</div>
  </div>
  <div style="text-align:right">
    <div class="payslip-badge">PAYSLIP</div>
    <div class="period">${monthName} ${year}</div>
  </div>
</div>

<div class="emp-grid">
  <div class="field"><label>Employee Name</label><span>${emp.firstName} ${emp.lastName}</span></div>
  <div class="field"><label>Employee No</label><span>${emp.employeeNumber}</span></div>
  <div class="field"><label>Department</label><span>${emp.department?.name || "—"}</span></div>
  <div class="field"><label>Position</label><span>${emp.jobTitle}</span></div>
  <div class="field"><label>ZIMRA Tax No</label><span>${emp.taxNumber || "N/A"}</span></div>
  <div class="field"><label>NSSA Number</label><span>${emp.nssaNumber || "N/A"}</span></div>
  <div class="field"><label>Bank</label><span>${emp.bankName || "—"} ${emp.bankAccount ? `· ${emp.bankAccount}` : ""}</span></div>
  <div class="field"><label>Contract</label><span>${emp.contractType}</span></div>
</div>

<table>
  <tr><th>Earnings</th><th>Amount (${item.currency})</th><th>Deductions</th><th>Amount (${item.currency})</th></tr>
  <tr><td>Basic Salary</td><td>$${item.basicSalary.toFixed(2)}</td><td>PAYE (ZIMRA)</td><td style="color:#c00">$${item.paye.toFixed(2)}</td></tr>
  <tr><td>Overtime</td><td>$${item.overtime.toFixed(2)}</td><td>AIDS Levy (3%)</td><td style="color:#c00">$${item.aidsLevy.toFixed(2)}</td></tr>
  <tr><td>Bonus</td><td>$${item.bonus.toFixed(2)}</td><td>NSSA Employee (3.5%)</td><td style="color:#c00">$${item.nssaEmployee.toFixed(2)}</td></tr>
  <tr><td>Commission</td><td>$${item.commission.toFixed(2)}</td><td>ZIMDEF Levy (1%)</td><td style="color:#c00">$${item.zimdef.toFixed(2)}</td></tr>
  <tr style="font-weight:600;background:#fafafa"><td>Gross Earnings</td><td>$${item.grossEarnings.toFixed(2)}</td><td>Total Deductions</td><td style="color:#c00;font-weight:600">$${item.totalDeductions.toFixed(2)}</td></tr>
</table>

<div class="net-bar">
  <div>
    <div class="net-label">Net Pay — ${item.currency}</div>
    <div style="font-size:10px;opacity:0.5;margin-top:2px">Payment: ${emp.paymentMethod} ${emp.bankAccount ? `· ${emp.bankAccount}` : ""}</div>
  </div>
  <div class="net-value">$${item.netPay.toFixed(2)}</div>
</div>

<div class="footer">
  Generated by ZimHR · MA TechHub · ${new Date().toLocaleDateString()} · This is a computer-generated payslip and requires no signature.
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BULK generate payslips for a run ──
router.post("/bulk-generate/:payrollRunId", async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where: { id: req.params.payrollRunId, companyId: req.user.companyId },
    });
    if (!run) return res.status(404).json({ error: "Run not found" });

    const items = await prisma.payrollItem.findMany({ where: { payrollRunId: run.id } });

    // Create payslip records
    await prisma.payslip.createMany({
      data: items.map(item => ({ payrollRunId: run.id, employeeId: item.employeeId })),
      skipDuplicates: true,
    });

    res.json({ message: `${items.length} payslips generated`, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

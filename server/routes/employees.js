const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();

// All routes require auth
router.use(protect);

// ── GET all employees ──
router.get("/", async (req, res) => {
  try {
    const { status, department, search } = req.query;
    const where = { companyId: req.user.companyId };

    if (status) where.employmentStatus = status;
    if (department) where.departmentId = department;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName:  { contains: search, mode: "insensitive" } },
        { employeeNumber: { contains: search, mode: "insensitive" } },
        { jobTitle: { contains: search, mode: "insensitive" } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single employee ──
router.get("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: {
        department: true,
        salaryHistory: { orderBy: { effectiveDate: "desc" } },
        leaveBalances: { include: { leaveType: true } },
        documents: true,
      },
    });

    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE employee ──
router.post("/", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const data = req.body;
    const companyId = req.user.companyId;

    // Auto-generate employee number
    const count = await prisma.employee.count({ where: { companyId } });
    const employeeNumber = `EMP-${String(count + 1).padStart(4, "0")}`;

    const employee = await prisma.employee.create({
      data: { ...data, companyId, employeeNumber },
      include: { department: true },
    });

    // Initialize leave balances for the new employee
    const leaveTypes = await prisma.leaveType.findMany({ where: { companyId, isActive: true } });
    const year = new Date().getFullYear();

    await prisma.leaveBalance.createMany({
      data: leaveTypes.map(lt => ({
        employeeId: employee.id,
        leaveTypeId: lt.id,
        year,
        entitled: lt.daysPerYear,
        remaining: lt.daysPerYear,
      })),
    });

    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE employee ──
router.put("/:id", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!existing) return res.status(404).json({ error: "Employee not found" });

    // Track salary changes
    if (req.body.basicSalary && req.body.basicSalary !== existing.basicSalary) {
      await prisma.salaryHistory.create({
        data: {
          employeeId: existing.id,
          oldSalary: existing.basicSalary,
          newSalary: req.body.basicSalary,
          currency: req.body.currency || existing.currency,
          effectiveDate: new Date(),
          reason: req.body.salaryChangeReason || "Updated",
          changedBy: `${req.user.firstName} ${req.user.lastName}`,
        },
      });
    }

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body,
      include: { department: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Terminate employee ──
router.post("/:id/terminate", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const { terminationType, terminationReason, terminationDate } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        employmentStatus: "TERMINATED",
        terminationType,
        terminationReason,
        terminationDate: new Date(terminationDate),
        endDate: new Date(terminationDate),
      },
    });

    res.json({ message: "Employee terminated", employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET departments ──
router.get("/meta/departments", async (req, res) => {
  const departments = await prisma.department.findMany({
    where: { companyId: req.user.companyId },
    include: { _count: { select: { employees: true } } },
  });
  res.json(departments);
});

// ── CREATE department ──
router.post("/meta/departments", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  const dept = await prisma.department.create({
    data: { ...req.body, companyId: req.user.companyId },
  });
  res.status(201).json(dept);
});

module.exports = router;

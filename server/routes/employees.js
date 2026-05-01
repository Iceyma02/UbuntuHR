const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();

// Helper: Convert date strings to Date objects
const parseDateFields = (data) => {
  const dateFields = ['dateOfBirth', 'startDate', 'probationEnd', 'endDate', 'terminationDate'];
  const result = { ...data };
  
  for (const field of dateFields) {
    if (result[field]) {
      if (typeof result[field] === 'string' && result[field].match(/^\d{4}-\d{2}-\d{2}/)) {
        result[field] = new Date(result[field]);
      }
      if (result[field] === '') {
        delete result[field];
      }
    }
  }
  return result;
};

// Helper: Clean empty strings
const cleanEmptyStrings = (data) => {
  const result = { ...data };
  const optionalFields = ['departmentId', 'ecocashNumber', 'address', 'nextOfKin', 'nextOfKinPhone', 'bankAccount', 'bankName'];
  
  for (const field of optionalFields) {
    if (result[field] === '' || result[field] === null || result[field] === undefined) {
      delete result[field];
    }
  }
  return result;
};

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
        { lastName: { contains: search, mode: "insensitive" } },
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

// ── CREATE employee (FIXED) ──
router.post("/", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    let data = { ...req.body };
    const companyId = req.user.companyId;

    // Fix dates
    data = parseDateFields(data);
    
    // Clean empty strings
    data = cleanEmptyStrings(data);

    // Parse salary to float
    if (data.basicSalary) {
      data.basicSalary = parseFloat(data.basicSalary);
    }

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

    if (leaveTypes.length > 0) {
      await prisma.leaveBalance.createMany({
        data: leaveTypes.map(lt => ({
          employeeId: employee.id,
          leaveTypeId: lt.id,
          year,
          entitled: lt.daysPerYear,
          remaining: lt.daysPerYear,
        })),
      });
    }

    res.status(201).json(employee);
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE employee ──
router.put("/:id", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    let data = { ...req.body };
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!existing) return res.status(404).json({ error: "Employee not found" });

    // Fix dates
    data = parseDateFields(data);
    data = cleanEmptyStrings(data);

    // Track salary changes
    if (data.basicSalary && data.basicSalary !== existing.basicSalary) {
      await prisma.salaryHistory.create({
        data: {
          employeeId: existing.id,
          oldSalary: existing.basicSalary,
          newSalary: data.basicSalary,
          currency: data.currency || existing.currency,
          effectiveDate: new Date(),
          reason: data.salaryChangeReason || "Updated",
          changedBy: `${req.user.firstName} ${req.user.lastName}`,
        },
      });
    }

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
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
        terminationDate: terminationDate ? new Date(terminationDate) : new Date(),
        endDate: terminationDate ? new Date(terminationDate) : new Date(),
      },
    });

    res.json({ message: "Employee terminated", employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET departments ──
router.get("/meta/departments", async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: { companyId: req.user.companyId },
      include: { _count: { select: { employees: true } } },
    });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE department ──
router.post("/meta/departments", requireRole("COMPANY_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const dept = await prisma.department.create({
      data: { ...req.body, companyId: req.user.companyId },
    });
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

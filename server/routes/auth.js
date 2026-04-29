const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../middleware/auth");

const prisma = new PrismaClient();

// ── Register Company + Admin ──
router.post("/register", async (req, res) => {
  try {
    const { companyName, email, password, firstName, lastName } = req.body;
    if (!companyName || !email || !password || !firstName || !lastName)
      return res.status(400).json({ error: "All fields required" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: companyName },
      });

      // Seed default leave types
      await tx.leaveType.createMany({
        data: [
          { companyId: company.id, name: "Annual Leave",      code: "AL",  daysPerYear: 30,  isPaid: true,  labourActRef: "Ch 28:01 s14" },
          { companyId: company.id, name: "Sick Leave",        code: "SL",  daysPerYear: 90,  isPaid: true,  labourActRef: "Ch 28:01 s14" },
          { companyId: company.id, name: "Maternity Leave",   code: "ML",  daysPerYear: 98,  isPaid: true,  labourActRef: "Ch 28:01 s18" },
          { companyId: company.id, name: "Paternity Leave",   code: "PL",  daysPerYear: 3,   isPaid: true,  labourActRef: "Ch 28:01" },
          { companyId: company.id, name: "Compassionate",     code: "CL",  daysPerYear: 3,   isPaid: true  },
          { companyId: company.id, name: "Unpaid Leave",      code: "UPL", daysPerYear: 0,   isPaid: false },
        ],
      });

      // Seed Zimbabwe public holidays
      const year = new Date().getFullYear();
      await tx.publicHoliday.createMany({
        data: [
          { companyId: company.id, name: "New Year's Day",          date: new Date(`${year}-01-01`), year },
          { companyId: company.id, name: "Robert Mugabe Day",        date: new Date(`${year}-02-21`), year },
          { companyId: company.id, name: "Good Friday",              date: new Date(`${year}-04-18`), year, isFixed: false },
          { companyId: company.id, name: "Easter Saturday",          date: new Date(`${year}-04-19`), year, isFixed: false },
          { companyId: company.id, name: "Easter Monday",            date: new Date(`${year}-04-21`), year, isFixed: false },
          { companyId: company.id, name: "Independence Day",         date: new Date(`${year}-04-18`), year },
          { companyId: company.id, name: "Workers Day",              date: new Date(`${year}-05-01`), year },
          { companyId: company.id, name: "Africa Day",               date: new Date(`${year}-05-25`), year },
          { companyId: company.id, name: "Zimbabwe Heroes Day",      date: new Date(`${year}-08-11`), year, isFixed: false },
          { companyId: company.id, name: "Defence Forces Day",       date: new Date(`${year}-08-12`), year, isFixed: false },
          { companyId: company.id, name: "Unity Day",                date: new Date(`${year}-12-22`), year },
          { companyId: company.id, name: "Christmas Day",            date: new Date(`${year}-12-25`), year },
          { companyId: company.id, name: "Boxing Day",               date: new Date(`${year}-12-26`), year },
        ],
      });

      const user = await tx.user.create({
        data: { email, password: hashed, firstName, lastName, role: "COMPANY_ADMIN", companyId: company.id },
      });

      return { company, user };
    });

    const token = jwt.sign({ id: result.user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: { id: result.user.id, email, firstName, lastName, role: result.user.role },
      company: { id: result.result?.company?.id, name: companyName },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── Login ──
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      company: { id: user.company.id, name: user.company.name },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Me ──
router.get("/me", protect, (req, res) => {
  const { id, email, firstName, lastName, role, company } = req.user;
  res.json({ id, email, firstName, lastName, role, company });
});

module.exports = router;

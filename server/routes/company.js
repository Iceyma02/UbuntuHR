const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { protect, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(protect);

router.get("/", async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  res.json(company);
});

router.put("/", requireRole("COMPANY_ADMIN"), async (req, res) => {
  const company = await prisma.company.update({
    where: { id: req.user.companyId },
    data: req.body,
  });
  res.json(company);
});

module.exports = router;

// ZimHR Frontend PAYE Calculator
// Mirrors server-side logic for instant preview

const USD_BANDS = [
  { lower: 0,    upper: 100,  rate: 0    },
  { lower: 100,  upper: 300,  rate: 0.20 },
  { lower: 300,  upper: 700,  rate: 0.25 },
  { lower: 700,  upper: 1500, rate: 0.30 },
  { lower: 1500, upper: null, rate: 0.40 },
];

const USD_TAX_CREDIT    = 900;
const AIDS_LEVY_RATE    = 0.03;
const NSSA_EMP_RATE     = 0.035;
const NSSA_EMP_RATE_ER  = 0.035;
const ZIMDEF_RATE       = 0.01;
const STD_LEVY          = 2;
const OVERTIME_MULTI    = 1.5;
const MONTHLY_HRS       = 160;

function round(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

export function calcPAYE(taxableIncome) {
  if (taxableIncome <= 0) return { paye: 0, aidsLevy: 0 };
  let tax = 0;
  for (const b of USD_BANDS) {
    if (taxableIncome <= b.lower) break;
    const upper = b.upper === null ? taxableIncome : Math.min(taxableIncome, b.upper);
    tax += (upper - b.lower) * b.rate;
  }
  const paye     = round(Math.max(0, tax - USD_TAX_CREDIT));
  const aidsLevy = paye > 0 ? round(paye * AIDS_LEVY_RATE) : 0;
  return { paye, aidsLevy };
}

export function calcPayroll({ basicSalary = 0, bonus = 0, commission = 0, allowances = 0, overtimeHours = 0 }) {
  const overtimePay   = round((basicSalary / MONTHLY_HRS) * OVERTIME_MULTI * overtimeHours);
  const grossEarnings = round(basicSalary + bonus + commission + allowances + overtimePay);
  const nssaEmployee  = round(grossEarnings * NSSA_EMP_RATE);
  const zimdef        = round(basicSalary * ZIMDEF_RATE);
  const taxableIncome = round(grossEarnings - nssaEmployee);
  const { paye, aidsLevy } = calcPAYE(taxableIncome);
  const totalDeductions    = round(paye + aidsLevy + nssaEmployee + zimdef);
  const netPay             = round(grossEarnings - totalDeductions);
  const nssaEmployer       = round(grossEarnings * NSSA_EMP_RATE_ER);
  const totalCostToCompany = round(grossEarnings + nssaEmployer + STD_LEVY);

  return {
    basicSalary: round(basicSalary), bonus: round(bonus), commission: round(commission),
    allowances: round(allowances), overtimePay, grossEarnings,
    nssaEmployee, taxableIncome, paye, aidsLevy, zimdef,
    totalDeductions, netPay,
    nssaEmployer, standardsLevy: STD_LEVY, totalCostToCompany,
    effectiveTaxRate: grossEarnings > 0 ? round(((paye + aidsLevy) / grossEarnings) * 100) : 0,
  };
}

export function fmtUSD(amount) {
  return `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getAvatarColor(name = "") {
  const colors = [
    "linear-gradient(135deg,#C9A84C,#8a6f2e)",
    "linear-gradient(135deg,#4A9FE8,#185FA5)",
    "linear-gradient(135deg,#2DD4A0,#0F6E56)",
    "linear-gradient(135deg,#9B7FE8,#534AB7)",
    "linear-gradient(135deg,#FF5C5C,#A32D2D)",
    "linear-gradient(135deg,#EF9F27,#8a5a00)",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function getInitials(firstName = "", lastName = "") {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export function getStatusBadge(status) {
  const map = {
    ACTIVE: "badge-green", PROBATION: "badge-gold", ON_LEAVE: "badge-blue",
    SUSPENDED: "badge-orange", TERMINATED: "badge-red",
    PERMANENT: "badge-green", CONTRACT: "badge-blue", CASUAL: "badge-gray", PART_TIME: "badge-purple", INTERN: "badge-purple",
    DRAFT: "badge-gold", LOCKED: "badge-green", PAID: "badge-green", PROCESSING: "badge-blue",
    PENDING: "badge-gold", APPROVED: "badge-green", REJECTED: "badge-red", CANCELLED: "badge-gray",
    FILED: "badge-green", OVERDUE: "badge-red",
  };
  return map[status] || "badge-gray";
}

export function formatPeriod(period) {
  if (!period) return "";
  const [y, m] = period.split("-");
  return new Date(`${y}-${m}-01`).toLocaleString("en-US", { month: "long", year: "numeric" });
}

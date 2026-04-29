/**
 * ZimHR — ZIMRA PAYE Calculator
 * Zimbabwe 2025/2026 Tax Tables (USD)
 * Labour Act Chapter 28:01 Compliant
 * Auto-updatable via database tax tables
 */

// ─────────────────────────────────────────────────────
// 2025/2026 USD TAX TABLES
// Source: Zimbabwe Finance Act & ZIMRA Guidelines
// Update every December after National Budget
// ─────────────────────────────────────────────────────

const USD_TAX_BANDS_2025 = [
  { lower: 0,    upper: 100,   rate: 0,    cumulative: 0   },
  { lower: 100,  upper: 300,   rate: 0.20, cumulative: 0   },
  { lower: 300,  upper: 700,   rate: 0.25, cumulative: 40  },
  { lower: 700,  upper: 1500,  rate: 0.30, cumulative: 140 },
  { lower: 1500, upper: null,  rate: 0.40, cumulative: 380 },
];

const USD_TAX_CREDIT_2025  = 900;   // Monthly tax credit (USD)
const AIDS_LEVY_RATE        = 0.03; // 3% of PAYE
const NSSA_EMPLOYEE_RATE    = 0.035; // 3.5% of gross
const NSSA_EMPLOYER_RATE    = 0.035; // 3.5% of gross
const ZIMDEF_RATE           = 0.01;  // 1% of basic salary
const STANDARDS_LEVY_FIXED  = 2;    // Fixed $2/month
const OVERTIME_MULTIPLIER   = 1.5;  // 1.5x basic hourly rate
const MONTHLY_HOURS         = 160;  // Standard monthly hours

// ─────────────────────────────────────────────────────
// ZiG TAX TABLES (mirrored in ZiG at official rate)
// ─────────────────────────────────────────────────────

const ZIG_TAX_BANDS_2025 = [
  { lower: 0,      upper: 1404,   rate: 0,    cumulative: 0      },
  { lower: 1404,   upper: 4212,   rate: 0.20, cumulative: 0      },
  { lower: 4212,   upper: 9828,   rate: 0.25, cumulative: 561.6  },
  { lower: 9828,   upper: 21060,  rate: 0.30, cumulative: 1965.6 },
  { lower: 21060,  upper: null,   rate: 0.40, cumulative: 5334.6 },
];

const ZIG_TAX_CREDIT_2025 = 12636; // Monthly tax credit (ZiG)


// ─────────────────────────────────────────────────────
// CORE PAYE CALCULATION
// ─────────────────────────────────────────────────────

/**
 * Calculate PAYE tax using progressive bands
 * @param {number} taxableIncome - Income after NSSA deduction
 * @param {string} currency - "USD" | "ZiG"
 * @returns {object} { paye, aidsLevy, totalTax }
 */
function calculatePAYE(taxableIncome, currency = "USD") {
  const bands = currency === "USD" ? USD_TAX_BANDS_2025 : ZIG_TAX_BANDS_2025;
  const credit = currency === "USD" ? USD_TAX_CREDIT_2025 : ZIG_TAX_CREDIT_2025;

  if (taxableIncome <= 0) return { paye: 0, aidsLevy: 0, totalTax: 0 };

  let taxBeforeCredit = 0;

  for (const band of bands) {
    if (taxableIncome <= band.lower) break;

    const upper = band.upper === null ? taxableIncome : Math.min(taxableIncome, band.upper);
    const taxableInBand = upper - band.lower;
    taxBeforeCredit += taxableInBand * band.rate;
  }

  // Apply tax credit
  let paye = Math.max(0, taxBeforeCredit - credit);

  // AIDS Levy — 3% of PAYE (only if PAYE > 0)
  const aidsLevy = paye > 0 ? paye * AIDS_LEVY_RATE : 0;

  return {
    paye: round(paye),
    aidsLevy: round(aidsLevy),
    totalTax: round(paye + aidsLevy),
  };
}


// ─────────────────────────────────────────────────────
// FULL PAYROLL CALCULATION
// ─────────────────────────────────────────────────────

/**
 * Full employee payroll calculation
 * @param {object} input
 * @param {number} input.basicSalary
 * @param {number} input.bonus
 * @param {number} input.commission
 * @param {number} input.allowances
 * @param {number} input.overtimeHours
 * @param {string} input.currency - "USD" | "ZiG"
 * @returns {object} Full payroll breakdown
 */
function calculateEmployeePayroll(input) {
  const {
    basicSalary = 0,
    bonus = 0,
    commission = 0,
    allowances = 0,
    overtimeHours = 0,
    currency = "USD",
  } = input;

  // ── Earnings ──
  const hourlyRate   = basicSalary / MONTHLY_HOURS;
  const overtimePay  = round(overtimeHours * hourlyRate * OVERTIME_MULTIPLIER);
  const grossEarnings = round(basicSalary + bonus + commission + allowances + overtimePay);

  // ── Statutory Deductions ──
  const nssaEmployee = round(grossEarnings * NSSA_EMPLOYEE_RATE);
  const zimdef       = round(basicSalary * ZIMDEF_RATE);

  // Taxable income = gross minus NSSA employee contribution
  const taxableIncome = round(grossEarnings - nssaEmployee);
  const { paye, aidsLevy, totalTax } = calculatePAYE(taxableIncome, currency);

  const totalDeductions = round(paye + aidsLevy + nssaEmployee + zimdef);
  const netPay = round(grossEarnings - totalDeductions);

  // ── Employer Costs ──
  const nssaEmployer   = round(grossEarnings * NSSA_EMPLOYER_RATE);
  const standardsLevy  = STANDARDS_LEVY_FIXED;
  const totalCostToCompany = round(grossEarnings + nssaEmployer + standardsLevy);

  return {
    // Earnings
    basicSalary:    round(basicSalary),
    bonus:          round(bonus),
    commission:     round(commission),
    allowances:     round(allowances),
    overtimePay,
    overtimeHours,
    grossEarnings,

    // Deductions
    nssaEmployee,
    taxableIncome,
    paye,
    aidsLevy,
    zimdef,
    totalDeductions,

    // Net
    netPay,

    // Employer
    nssaEmployer,
    standardsLevy,
    totalCostToCompany,

    // Summary
    currency,
    effectiveTaxRate: grossEarnings > 0 ? round((totalTax / grossEarnings) * 100) : 0,
  };
}


// ─────────────────────────────────────────────────────
// BONUS / 13TH CHEQUE CALCULATION
// ─────────────────────────────────────────────────────

/**
 * Calculate tax on bonus using annual aggregation method
 * Bonus is added to annual income and taxed at the marginal rate
 */
function calculateBonusTax(monthlySalary, bonusAmount, currency = "USD") {
  const annualSalary = monthlySalary * 12;
  const totalWithBonus = annualSalary + bonusAmount;

  const taxOnAnnual = calculatePAYE(annualSalary, currency).totalTax * 12;
  const taxOnTotal  = calculatePAYE(totalWithBonus / 12, currency).totalTax * 12;

  const bonusTax = round(taxOnTotal - taxOnAnnual);

  return {
    bonusAmount,
    bonusTax: Math.max(0, bonusTax),
    netBonus: round(bonusAmount - Math.max(0, bonusTax)),
  };
}


// ─────────────────────────────────────────────────────
// LEAVE ENCASHMENT CALCULATION
// ─────────────────────────────────────────────────────

/**
 * Calculate value of unused leave days
 * @param {number} basicSalary - Monthly basic salary
 * @param {number} unusedDays - Number of unused leave days
 * @param {number} workingDays - Working days in month (default 22)
 */
function calculateLeaveEncashment(basicSalary, unusedDays, workingDays = 22) {
  const dailyRate = basicSalary / workingDays;
  const encashmentValue = round(dailyRate * unusedDays);
  return { dailyRate: round(dailyRate), unusedDays, encashmentValue };
}


// ─────────────────────────────────────────────────────
// NSSA CALCULATION
// ─────────────────────────────────────────────────────

function calculateNSSA(grossSalary) {
  return {
    employee: round(grossSalary * NSSA_EMPLOYEE_RATE),
    employer: round(grossSalary * NSSA_EMPLOYER_RATE),
    total:    round(grossSalary * (NSSA_EMPLOYEE_RATE + NSSA_EMPLOYER_RATE)),
  };
}


// ─────────────────────────────────────────────────────
// BULK PAYROLL PROCESSING
// ─────────────────────────────────────────────────────

/**
 * Process payroll for multiple employees at once
 * @param {Array} employees - Array of employee payroll inputs
 * @returns {object} Bulk payroll results + totals
 */
function processBulkPayroll(employees) {
  const results = employees.map(emp => ({
    employeeId: emp.employeeId,
    employeeName: emp.employeeName,
    ...calculateEmployeePayroll(emp),
  }));

  const totals = results.reduce((acc, r) => ({
    totalGross:       round(acc.totalGross + r.grossEarnings),
    totalPaye:        round(acc.totalPaye + r.paye),
    totalAidsLevy:    round(acc.totalAidsLevy + r.aidsLevy),
    totalNssa:        round(acc.totalNssa + r.nssaEmployee),
    totalZimdef:      round(acc.totalZimdef + r.zimdef),
    totalDeductions:  round(acc.totalDeductions + r.totalDeductions),
    totalNet:         round(acc.totalNet + r.netPay),
    totalEmployerNssa:round(acc.totalEmployerNssa + r.nssaEmployer),
    totalCostToCompany: round(acc.totalCostToCompany + r.totalCostToCompany),
  }), {
    totalGross: 0, totalPaye: 0, totalAidsLevy: 0, totalNssa: 0,
    totalZimdef: 0, totalDeductions: 0, totalNet: 0,
    totalEmployerNssa: 0, totalCostToCompany: 0,
  });

  return { results, totals, employeeCount: results.length };
}


// ─────────────────────────────────────────────────────
// PENALTY CALCULATOR
// ─────────────────────────────────────────────────────

/**
 * Calculate ZIMRA late filing penalties
 * @param {string} type - "PAYE" | "NSSA" | "P6"
 * @param {number} taxDue - Amount of tax that was due
 * @param {number} monthsLate - Number of months overdue
 * @param {number} employeeCount - For P6 calculation
 */
function calculatePenalty(type, taxDue = 0, monthsLate = 1, employeeCount = 1) {
  switch (type) {
    case "PAYE":
      return {
        type: "PAYE Late Filing",
        basePenalty: 200,
        interestPenalty: round(taxDue * 0.10 * monthsLate),
        total: round(200 + (taxDue * 0.10 * monthsLate)),
      };
    case "NSSA":
      return {
        type: "NSSA Late Filing",
        basePenalty: 200 * monthsLate,
        interestPenalty: 0,
        total: 200 * monthsLate,
      };
    case "P6":
      return {
        type: "P6 Certificate Late",
        basePenalty: 30 * employeeCount * monthsLate,
        interestPenalty: 0,
        total: 30 * employeeCount * monthsLate,
      };
    default:
      return { type, basePenalty: 0, interestPenalty: 0, total: 0 };
  }
}


// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(amount, currency = "USD") {
  const prefix = currency === "USD" ? "$" : "ZiG ";
  return `${prefix}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


module.exports = {
  calculatePAYE,
  calculateEmployeePayroll,
  calculateBonusTax,
  calculateLeaveEncashment,
  calculateNSSA,
  processBulkPayroll,
  calculatePenalty,
  formatCurrency,
  round,
  USD_TAX_BANDS_2025,
  ZIG_TAX_BANDS_2025,
  USD_TAX_CREDIT_2025,
  ZIG_TAX_CREDIT_2025,
  NSSA_EMPLOYEE_RATE,
  NSSA_EMPLOYER_RATE,
  ZIMDEF_RATE,
};

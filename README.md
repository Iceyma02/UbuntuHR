# ZimHR — Zimbabwe HR & Payroll System
### Built by MA TechHub · Harare, Zimbabwe 🇿🇼

> The most accurate, ZIMRA-compliant, feature-complete HR and Payroll system built for Zimbabwe — and designed to scale to the rest of Africa.

---

## 🚀 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18 + React Router + Recharts |
| Styling     | Custom CSS Design System (no framework) |
| Backend     | Node.js + Express                 |
| Database    | PostgreSQL via Prisma ORM         |
| Auth        | JWT + bcrypt                      |
| Hosting FE  | Vercel (free)                     |
| Hosting BE  | Railway (free tier)               |
| PDF         | Server-side HTML → PDF via Puppeteer |

---

## 📦 Project Structure

```
zimhr/
├── client/                   # React frontend
│   ├── public/
│   └── src/
│       ├── components/       # Sidebar, Topbar
│       ├── context/          # AuthContext
│       ├── pages/
│       │   ├── Dashboard/    # Module 6 — Analytics overview
│       │   ├── Employees/    # Module 3 — Employee records
│       │   ├── Payroll/      # Module 1 — Payroll engine
│       │   ├── Compliance/   # Module 2 — ZIMRA & NSSA
│       │   ├── Leave/        # Module 4 — Leave management
│       │   ├── Payslips/     # Module 5 — Payslip generation
│       │   └── Analytics/    # Module 6 — Full analytics
│       ├── services/api.js   # Axios API layer
│       └── utils/payroll.js  # PAYE calculator (frontend)
│
└── server/                   # Node.js backend
    ├── prisma/
    │   └── schema.prisma     # Full DB schema
    ├── routes/               # All API endpoints
    ├── middleware/auth.js    # JWT middleware
    ├── utils/
    │   └── payeCalculator.js # ZIMRA tax engine
    └── index.js              # Express app
```

---

## ⚙️ Setup Instructions

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
```

### 3. Set Up Database

```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run Development

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm start
```

Open http://localhost:3000 — register your company and you're live.

---

## 🚀 Deploy to Production (Free)

### Backend → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd server
railway init
railway add postgresql
railway up
```

Copy the DATABASE_URL from Railway dashboard to your .env

### Frontend → Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd client
vercel
```

Set environment variable in Vercel: `REACT_APP_API_URL` = your Railway backend URL

---

## 🧮 ZIMRA PAYE Tax Engine

The payroll engine in `server/utils/payeCalculator.js` handles:

- ✅ 2025/2026 USD progressive tax bands
- ✅ 2025/2026 ZiG progressive tax bands
- ✅ $900/month USD tax credit
- ✅ AIDS Levy (3% of PAYE)
- ✅ NSSA employee 3.5% + employer 3.5%
- ✅ ZIMDEF levy 1% of basic
- ✅ Standards Levy $2/employee/month
- ✅ Overtime at 1.5x
- ✅ Bonus tax calculation (annual aggregation)
- ✅ Leave encashment calculation
- ✅ Bulk payroll processing
- ✅ ZIMRA penalty calculator

**Update tax tables every December** after the National Budget announcement.

---

## 📋 Modules

| Module | Status | Description |
|--------|--------|-------------|
| 1. Payroll Engine     | ✅ Complete | ZIMRA PAYE, NSSA, ZIMDEF, bulk processing |
| 2. ZIMRA Compliance   | ✅ Complete | Returns, tax tables, penalty calculator |
| 3. Employee Records   | ✅ Complete | Full profiles, salary history, documents |
| 4. Leave Management   | ✅ Complete | Labour Act compliant, liability report |
| 5. Payslips           | ✅ Complete | PDF generation, WhatsApp/email delivery |
| 6. Analytics          | ✅ Complete | Dashboards, forecasting, charts |

---

## 💰 Pricing Model

| Plan     | Price/month | Employees |
|----------|-------------|-----------|
| Starter  | $50         | Up to 20  |
| Growth   | $100        | Up to 50  |
| Pro      | $200        | Up to 150 |
| Enterprise | Custom    | Unlimited |

---

## 🇿🇼 Compliance References

- Zimbabwe Income Tax Act [Chapter 23:06]
- ZIMRA PAYE Guidelines 2025/2026
- NSSA Act [Chapter 17:04]
- Labour Act [Chapter 28:01]
- ZIMDEF Act
- Finance Act 2025

---

## 👨‍💻 Built by

**Anesu Manjengwa (Icey)**  
Founder — MA TechHub  
linkedin.com/in/anesu-manjengwa-684766247  
github.com/Iceyma02

---

*From Zimbabwe. For Zimbabwe. To the world.*

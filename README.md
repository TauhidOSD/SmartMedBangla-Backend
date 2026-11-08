# 💊 SmartMed

**AI prescription reader, Bangla voice medicine reminders and a family care dashboard — in the browser, no app download.**

| | Link |
| --- | --- |
| 🌐 Live app | _add the Vercel URL here_ |
| ⚙️ API | _add the Render URL here_ (`/api/health`) |
| 📦 Backend repo (this repo — API + all project docs) | https://github.com/GeorgeBlaize/backend |
| 🖥️ Frontend repo | https://github.com/GeorgeBlaize/frontend |
| 📋 Project board | _add the GitHub Projects / Trello link here_ — backlog in [docs/PROJECT_BOARD.md](docs/PROJECT_BOARD.md) |

> ডাক্তারের অস্পষ্ট হাতের লেখা পড়া, বাংলায় ভয়েস রিমাইন্ডার, ওষুধের মেয়াদ ট্র্যাকিং এবং দূরে থাকা সন্তানদের জন্য কেয়ারগিভার ড্যাশবোর্ড।

## Problem → solution

| Problem (Bangladesh) | SmartMed |
| --- | --- |
| Doctors' handwriting is unreadable → wrong medicines | Photo → **Gemini vision OCR + LLM** → medicine names & doses in large text |
| Elderly users can't manage app stores / storage | A bookmarkable website with **large-text mode** and a very simple UI |
| Text notifications are hard to read | **Bangla voice reminders** with the Web Speech API: “দাদু, এখন আপনার ভরা পেটে নাপা এক্সটেন্ড খাওয়ার সময় হয়েছে।” |
| Tiny expiry dates on strips | **AI expiry scanner** + alerts 7 days before expiry |
| Children abroad can't check on parents | **Caregiver dashboard** + email “action alert” when a dose is missed |
| Paper prescriptions get lost | **Cloud prescription history** + time-limited **doctor share link** |

**Target users:** elderly & chronic patients, family caregivers (often abroad), nurses.
**USP:** handwriting → verified schedule → Bangla voice, with the family in the loop.

## Features (17 · 7 AI)

1. Registration, login, JWT auth with refresh-token rotation, role-based access (Patient / Caregiver / Doctor / Pharmacy / Admin)
2. Security: email OTP verification, OTP password reset, account lockout, session/device management, rate limiting
3. 🤖 AI prescription OCR → draft medicines → patient review → confirm
4. Prescription cloud history (search, filter, pagination) + doctor share link
5. Medicines with flexible reminders (1+0+1 patterns, days of week, quantity, pause/resume)
6. Daily dose schedule with one-tap Taken / Skip / Undo, missed-dose detection
7. Bangla voice alerts + browser push notifications (service worker) + in-app notification centre
8. 🤖 Medicine cabinet with AI expiry scanner + expiry alerts
9. Caregiver invitations, caregiver dashboard, missed-dose & expiry alerts for family
10. 🤖 Medicine explainer · 🤖 drug-interaction checker · 🤖 health assistant chat (voice input) · 🤖 adherence coach
11. Adherence analytics (charts by day, medicine, time of day, streaks)
12. Premium subscription with SSLCommerz (bKash/Nagad/cards), free-plan AI quota
13. Admin dashboard: statistics & charts, user management (role, suspend, premium, force logout, delete), prescription moderation, payments, AI usage logs, audit trail, broadcasts
14. Accessibility & UX: light/dark/system theme, large text, Bangla/English, fully responsive, skip links, ARIA labels
15. 🩺 Doctor QR prescriptions: a doctor types the prescription, prints it with a QR code; the patient scans it and medicines + reminders are added instantly (no OCR needed)
16. 🏪 Pharmacy dashboard: 🤖 scan a customer's paper prescription, hand it over by QR, email or straight into the customer's account; admin verifies BMDC / drug-licence numbers
17. 📱 Offline alerts: SMS (BulkSMSBD or Twilio) and voice-call reminders read aloud in Bangla — for button phones and no-internet moments; caregivers can switch them on for an elder

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod, Recharts, next-themes |
| Backend | Node.js, Express 5 (MVC), TypeScript, Zod, JWT, bcrypt, Multer, Helmet, express-rate-limit |
| Database | PostgreSQL + **Prisma v7** (driver adapter `@prisma/adapter-pg`) |
| Jobs & cache | Redis + **BullMQ** job schedulers (falls back to node-cron + memory cache) |
| AI | Google **Gemini** (vision + text) with **Groq** fallback |
| Services | Cloudinary (images), Nodemailer/SMTP (OTP & alerts), Web Push (VAPID), SSLCommerz |
| Deploy | Vercel (frontend) · Render/Railway (API) · Neon/Supabase (Postgres) · Upstash (Redis) |

New technologies used: Prisma v7 driver adapters, BullMQ job schedulers, Gemini vision structured output, Web Speech API (synthesis + recognition), Web Push, Next.js 16 Cache Components & `proxy.ts`.

## Documentation

- [ERD & database schema](docs/ERD.md)
- [System architecture & SDA workflow](docs/ARCHITECTURE.md)
- [REST API reference](docs/API.md) · [Postman collection](docs/SmartMed.postman_collection.json)
- Draw.io diagrams: [ERD](docs/diagrams/erd.drawio) · [System architecture](docs/diagrams/architecture.drawio) (open in [app.diagrams.net](https://app.diagrams.net))
- [Testing plan & results](docs/TESTING.md)
- [Project board / sprint backlog](docs/PROJECT_BOARD.md) · [Contributing & Git workflow](CONTRIBUTING.md)

## Requirement checklist

| Requirement | Where |
| --- | --- |
| Problem, target users, solution, USP | Top of this README |
| 12+ features (17) · 5+ AI features (7) | [Features](#features-17--7-ai) |
| Real backend data, no dummy data | Every screen reads PostgreSQL through the API; the seed only creates the admin |
| Auth, roles, protected routes | JWT + rotating refresh cookies, 5 roles, `proxy.ts` + `authorize()` middleware |
| 2+ security features | Email OTP, OTP password reset, account lockout, session/device management, rate limits, Helmet |
| Admin dashboard | `/admin` — stats, users, moderation, payments, AI logs, audit log, broadcasts, professional verification |
| AI provider + fallback | Gemini → Groq fallback → friendly 503 / manual entry |
| Responsive, light/dark | Tailwind breakpoints, next-themes |
| ERD, schema, architecture, API structure | [docs/](docs) + Draw.io files |
| Validation & error handling | Zod on every request, one JSON error envelope, loading/empty/error states in the UI |
| 2+ new technologies | See the list under [Tech stack](#tech-stack) |
| Git workflow, PRs, reviews | [CONTRIBUTING.md](CONTRIBUTING.md), PR template, GitHub Actions CI |

## Project structure

Two repositories — clone both into one folder:

```
Smartmed/
├── backend/            # github.com/GeorgeBlaize/backend — Express MVC API + docs/
│   ├── docs/           # ERD, architecture, API, Draw.io, Postman, testing, board
│   ├── prisma/         # schema.prisma, migrations, seed (admin only)
│   └── src/
│       ├── config/     # env (Zod-validated), prisma, redis, cloudinary
│       ├── routes/     # one router per feature
│       ├── middlewares/# auth, roles, patient scope, validation, upload, errors
│       ├── controllers/
│       ├── services/   # business logic (+ ai/ provider, prompts, schemas)
│       ├── models/     # Prisma data access
│       ├── validators/ # Zod request schemas
│       ├── views/      # email templates
│       ├── jobs/       # reminder / missed-dose / expiry schedulers
│       └── utils/
└── frontend/           # github.com/GeorgeBlaize/frontend — Next.js app (src/features/<feature>)
```

## Run locally

Requirements: Node 20.19+ (tested on 24), PostgreSQL 14+. Redis is optional.

```bash
# 1. Backend
cd backend
cp .env.example .env          # set DATABASE_URL, JWT secrets, GEMINI_API_KEY, CLOUDINARY_* …
npm install
npx prisma migrate deploy     # creates the tables
npm run db:seed               # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:5000/api/health

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env.local    # BACKEND_URL=http://localhost:5000
npm install
npm run dev                   # http://localhost:3000
```

Without SMTP configured, OTP codes are printed in the backend console (`[email disabled] … subject="123456 is your …"`).
Without `GEMINI_API_KEY`/`GROQ_API_KEY` the AI endpoints answer with a friendly 503 and prescriptions can still be entered manually.
SMS / voice calls default to `SMS_PROVIDER=log` / `VOICE_PROVIDER=log` (messages are only written to the server log). Set `SMS_PROVIDER=bulksmsbd` with `BULKSMSBD_API_KEY` + `BULKSMSBD_SENDER_ID`, or `twilio` (also `VOICE_PROVIDER=twilio`) with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Each message costs money on the provider account.

## Deployment

**Database:** create a Postgres database (Neon / Supabase / Render) and copy its URL.

**API (Render):** New → *Blueprint* → pick this repo (uses [render.yaml](render.yaml)), or a *Web Service* with the repo root →
- Build: `npm ci && npm run build && npx prisma migrate deploy`
- Start: `npm start`
- Env: everything from `.env.example` with `NODE_ENV=production`, `COOKIE_SECURE=true`, `CLIENT_URL=https://<your-vercel-app>`, `API_PUBLIC_URL=https://<your-api>`
- Run `npm run db:seed` once from the Render shell.

**Frontend (Vercel):** import the `frontend` repo → env `BACKEND_URL=https://<your-api>` → deploy.

After both are live: set `CLIENT_URL` on Render to the Vercel URL (it is used for CORS, email links and the QR prescription links), redeploy the API, then open `<vercel-url>/api/health` to check the connection.

**Redis (optional, recommended):** Upstash → set `REDIS_URL` on the API for BullMQ.
**Web Push:** `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
**SSLCommerz:** sandbox store at developer.sslcommerz.com → `SSLC_STORE_ID` / `SSLC_STORE_PASSWORD`.

## Git workflow (team)

- `main` = production (protected, deploys automatically) · `develop` = integration
- Feature branches: `feature/<ticket>-short-name`, fixes: `fix/<ticket>-…`
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`…), PR into `develop` with at least one review
- Release PR `develop → main` at the end of each MVP sprint
- CI (GitHub Actions) type-checks, lints and builds every PR — see [CONTRIBUTING.md](CONTRIBUTING.md)

## Team

| Member | Role | Main areas |
| --- | --- | --- |
| Touhid | Team lead | Architecture, auth & security, deployment, reviews |
| Alamin | Backend | Prescriptions, medicines, reminders, jobs |
| Jonathon | AI | Gemini/Groq integration, OCR, assistant, insights |
| Yousuf | Frontend | Design system, landing page, dashboard UI, i18n |
| Ibrahim | Full-stack | Caregiver, admin dashboard, payments, QR & SMS alerts |

## Disclaimer

SmartMed helps patients follow their doctor's prescription; it is not a medical device and does not give diagnoses.
AI output is always reviewed by the patient before reminders start. In an emergency call **999**.

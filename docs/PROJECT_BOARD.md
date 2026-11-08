# Project board — SmartMed

Recommended tool: **GitHub Projects** (board view) linked to both repositories, so cards and pull requests stay connected.
Columns: **Backlog → Sprint (To do) → In progress → In review → Done**, plus a **Bugs** label.
Every card = one branch = one pull request (`feature/SM-<id>-…`).

Import option: [project-board.csv](project-board.csv) works with Jira (*Import issues from CSV*), ClickUp and Trello (via CSV import power-ups).
For GitHub Projects, create the cards from this list (or run the `gh` script at the end).

| Member | Role |
| --- | --- |
| Touhid | Team lead — architecture, auth/security, deployment, reviews |
| Alamin | Backend — data model, medicines, reminders, jobs |
| Jonathon | AI — Gemini/Groq, OCR, assistant, scanners |
| Yousuf | Frontend — design system, pages, UX, testing |
| Ibrahim | Full-stack — caregiver, admin, payments, QR & alerts |

## MVP 01 — Foundation (Week 1)

| ID | Task | Assignee | Area |
| --- | --- | --- | --- |
| SM-1 | Finalize problem, target users, USP, feature list | Touhid | docs |
| SM-2 | Set up GitHub repos, branch protection, develop branch | Touhid | devops |
| SM-3 | Project board, labels, sprint setup | Touhid | devops |
| SM-4 | ERD + database schema (Prisma) + Draw.io diagram | Alamin | backend |
| SM-5 | System architecture / SDA workflow diagram | Touhid | docs |
| SM-6 | API endpoint structure document | Alamin | docs |
| SM-7 | Express MVC skeleton, env validation, error envelope | Alamin | backend |
| SM-8 | Neon PostgreSQL connection + core models + first migration | Alamin | backend |
| SM-9 | Design system: colours, typography, shadcn components, light/dark | Yousuf | frontend |
| SM-10 | Responsive homepage (BN/EN toggle, default Bangla) | Yousuf | frontend |
| SM-11 | Features page + Pricing page + navigation | Yousuf | frontend |
| SM-12 | AI provider research: Gemini vision + Groq fallback spike | Jonathon | ai |
| SM-13 | Initial deployment: Vercel (frontend) + Render (API) | Ibrahim | devops |

## MVP 02 — Core development (Week 2)

| ID | Task | Assignee | Area |
| --- | --- | --- | --- |
| SM-14 | Registration + login + JWT access/refresh cookies | Touhid | backend |
| SM-15 | Email OTP verification + OTP password reset | Touhid | backend |
| SM-16 | Account lockout, rate limiting, session/device management | Touhid | backend |
| SM-17 | Protected routes (proxy.ts) + role authorization | Ibrahim | frontend |
| SM-18 | Prescription upload → Cloudinary → AI OCR draft | Jonathon | ai |
| SM-19 | Prescription review & confirm screen | Yousuf | frontend |
| SM-20 | Medicines CRUD + flexible reminders (1+0+1, days, quantity) | Alamin | backend |
| SM-21 | Daily dose schedule: taken / skip / undo | Alamin | backend |
| SM-22 | Today screen + dose history UI | Yousuf | frontend |
| SM-23 | Caregiver invitations + caregiver dashboard | Ibrahim | backend |
| SM-24 | Loading / empty / error states on every list | Yousuf | frontend |
| SM-25 | AI medicine explainer + interaction checker | Jonathon | ai |
| SM-26 | Deploy latest stable build + update ERD | Ibrahim | devops |

## MVP 03 — Production release (Week 3)

| ID | Task | Assignee | Area |
| --- | --- | --- | --- |
| SM-27 | Bangla voice reminders + web push + notification centre | Ibrahim | frontend |
| SM-28 | Background jobs: reminders, missed-dose & expiry alerts | Alamin | backend |
| SM-29 | Medicine cabinet + AI expiry scanner | Jonathon | ai |
| SM-30 | AI health assistant chat (voice input) + adherence coach | Jonathon | ai |
| SM-31 | Adherence analytics charts | Yousuf | frontend |
| SM-32 | Premium plan with SSLCommerz + free AI quota | Ibrahim | backend |
| SM-33 | Admin dashboard: stats, users, moderation, payments, AI logs, audit | Touhid | frontend |
| SM-34 | Doctor QR prescriptions + patient claim flow | Ibrahim | backend |
| SM-35 | Pharmacy dashboard + AI scan for customers + admin licence verification | Jonathon | ai |
| SM-36 | SMS / voice-call alerts (BulkSMSBD / Twilio) | Alamin | backend |
| SM-37 | Security pass: dependency audit, patient-scope rules, headers | Touhid | devops |
| SM-38 | Functional, responsive, API & auth testing (TESTING.md) | Yousuf | docs |
| SM-39 | Final ERD, architecture, API docs, Postman collection | Alamin | docs |
| SM-40 | Production deploy + presentation | Touhid | devops |

## Bug tracking

Bugs are cards with the `bug` label (issue template: *Bug report*). Examples fixed during MVP 03:

| ID | Bug | Fix |
| --- | --- | --- |
| BUG-1 | Image upload failed with "Stale request" when the server clock was wrong | Signing timestamp follows Cloudinary's clock |
| BUG-2 | Upload dialog showed a broken image preview in development | Blob URL is no longer revoked during Strict Mode remount |
| BUG-3 | Doctors/pharmacies could reach patient-scoped endpoints | Patient scope limited to patient, caregiver and admin |

## Create the cards with GitHub CLI (optional)

```bash
# run inside the backend repo after `gh auth login` (create the labels backend/frontend/ai/docs/devops first)
python -c "import csv,subprocess; [subprocess.run(['gh','issue','create','--title',r['Issue key']+' '+r['Summary'],'--label',r['Labels'],'--body','Sprint: '+r['Sprint']+' / Assignee: '+r['Assignee']]) for r in csv.DictReader(open('docs/project-board.csv',encoding='utf8'))]"
```

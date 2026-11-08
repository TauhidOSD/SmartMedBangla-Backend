# Testing plan & results — SmartMed

Legend: ✅ passed · ⬜ to be checked on the live deployment before submission

## 1. Automated checks (every pull request — GitHub Actions)

Results below were verified locally; the same steps run in CI (`.github/workflows/ci.yml`) on every push and PR.

| Check | Backend | Frontend |
| --- | --- | --- |
| Install from lockfile (`npm ci`) | ✅ | ✅ |
| Prisma schema validation + all migrations on a fresh PostgreSQL | ✅ | — |
| TypeScript type-check | ✅ | ✅ |
| ESLint | — | ✅ |
| Production build | ✅ | ✅ |
| API smoke test: health = database up, `/auth/me` → 401 anonymous, bad registration → 400 | ✅ | — |
| Dependency audit (`npm audit --omit=dev`) | ✅ 0 vulnerabilities | ✅ none in shipped code (remaining low/moderate items are in the `shadcn` build CLI) |

## 2. API / end-to-end tests (run against a disposable local PostgreSQL)

Postman: import [SmartMed.postman_collection.json](SmartMed.postman_collection.json), set `baseUrl`, `email`, `password`, run **POST /auth/login** first.

| # | Scenario | Expected | Result |
| --- | --- | --- | --- |
| 1 | Doctor registers without hospital / licence | 400 with field message | ✅ |
| 2 | Doctor registers with licence, verifies email | 201, then 200 | ✅ |
| 3 | Doctor writes a QR prescription | 201, code + claim URL | ✅ |
| 4 | Public preview of a code · short code · unknown code | 200 · 400 · 404 | ✅ |
| 5 | Claim while logged out · as doctor · as patient | 401 · 403 · 201 | ✅ |
| 6 | Same patient claims again | 200 (idempotent) | ✅ |
| 7 | Another patient claims the same code | 409 | ✅ |
| 8 | Claimed prescription creates medicines + reminders + today's doses | VERIFIED, source DOCTOR | ✅ |
| 9 | Doctor deletes a claimed prescription | 400 | ✅ |
| 10 | Pharmacy sends to an existing account · to an email without account | added to account · email link | ✅ |
| 11 | Pharmacy prescription arrives as "needs review" | PROCESSED, source PHARMACY | ✅ |
| 12 | Issuer opens another issuer's prescription | 404 | ✅ |
| 13 | Admin verifies a doctor → preview shows verified | `isProVerified: true` | ✅ |
| 14 | Doctor changes licence number | verification removed | ✅ |
| 15 | Test alert without phone · with phone | 400 · 200 (logged when no SMS provider) | ✅ |
| 16 | Caregiver sets alerts for a non-linked patient · linked patient | 403 · 200 | ✅ |
| 17 | Doctor tries a caregiver-only endpoint | 403 | ✅ |
| 18 | Image upload to Cloudinary with a wrong server clock | upload succeeds (clock compensated) | ✅ |

## 3. Authentication & security

| Check | Result |
| --- | --- |
| Register → OTP email → verify → dashboard | ✅ |
| Login with wrong password 5× → account locked 15 min | ⬜ |
| Forgot password → OTP → reset → all other devices logged out | ⬜ |
| Expired access token refreshes silently (rotating refresh cookie) | ⬜ |
| Logged-out user opening `/dashboard` or `/admin` is redirected to login | ⬜ |
| Patient opening `/admin` → forbidden | ⬜ |
| Session list shows devices; "log out other devices" works | ⬜ |
| No secrets in either repo (`.env` ignored, only `.env.example`) | ✅ |

## 4. Functional checklist (live site)

| Area | Check | Result |
| --- | --- | --- |
| Home | BN/EN toggle translates the whole site, default Bangla | ⬜ |
| Prescriptions | Upload photo → AI reads → review → confirm → reminders start | ⬜ |
| Prescriptions | Search, status filter, pagination | ⬜ |
| Medicines | Add / edit / pause / delete, 1+0+1 pattern | ⬜ |
| Today | Taken / skip / undo; missed dose after grace period | ⬜ |
| Voice | Bangla voice reminder plays; "Test voice" in settings | ⬜ |
| Cabinet | AI expiry scan; expiry alert 7 days before | ⬜ |
| AI | Medicine explainer, interaction checker, assistant chat, adherence insight | ⬜ |
| AI fallback | With Gemini key removed, Groq answers; with both removed a friendly message shows | ⬜ |
| Caregiver | Invite → accept → dashboard → patient overview tabs | ⬜ |
| Doctor | Write prescription → print with QR → patient scans with a phone | ⬜ |
| Pharmacy | Scan paper prescription → hand over by QR / email | ⬜ |
| Alerts | SMS / call toggles, "Send a test" | ⬜ |
| Billing | SSLCommerz sandbox payment → Premium | ⬜ |
| Admin | Stats, users (role, suspend, premium, verify, force logout, delete), moderation, payments, AI logs, audit log, broadcast | ⬜ |
| Share | Doctor share link opens read-only summary, expires | ⬜ |

## 5. Responsive & accessibility

Test each main page at **360 px** (phone), **768 px** (tablet) and **1280 px** (desktop), in light and dark mode.

| Page | 360 | 768 | 1280 | Dark |
| --- | --- | --- | --- | --- |
| Home | ⬜ | ⬜ | ⬜ | ⬜ |
| Login / Register | ⬜ | ⬜ | ⬜ | ⬜ |
| Dashboard (Today) | ⬜ | ⬜ | ⬜ | ⬜ |
| Prescription detail / review | ⬜ | ⬜ | ⬜ | ⬜ |
| Issued prescription (print view) | ⬜ | ⬜ | ⬜ | ⬜ |
| Admin users | ⬜ | ⬜ | ⬜ | ⬜ |

Accessibility: keyboard navigation and visible focus, skip link, large-text mode, labels on every input, colour contrast (Lighthouse ≥ 90).

## Bugs found & fixed

See the *Bug tracking* table in [PROJECT_BOARD.md](PROJECT_BOARD.md).

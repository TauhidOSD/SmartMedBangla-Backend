# SmartMed REST API

Base URL: `https://<api-host>/api` (the frontend proxies `/api/*` to it).

- **Auth:** httpOnly cookies `sm_access` / `sm_refresh` set by login. API clients (Postman) can send `Authorization: Bearer <accessToken>` from the login response instead.
- **Patient scope:** endpoints marked 🧑‍⚕️ act on the logged-in patient. Caregivers (for patients who accepted them) and admins add `?patientId=<id>`.
- **Success:** `{ "success": true, "message": "...", "data": ..., "meta"?: { page, limit, total, totalPages } }`
- **Error:** `{ "success": false, "message": "...", "code"?: "TOKEN_EXPIRED" | "EMAIL_NOT_VERIFIED" | "PLAN_LIMIT" | "AI_UNAVAILABLE" | ..., "errors"?: [{ field, message }] }`
- **Status codes:** 400 validation · 401 unauthenticated · 402 plan limit · 403 forbidden · 404 not found · 409 conflict · 423 account locked · 429 rate limited · 503 AI/storage unavailable

Legend: 🔓 public · 🔐 logged in · ✉️ verified email required · 👤 role restricted

## Health & public

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | 🔓 | Database status + which integrations are configured |
| GET | `/stats/public` | 🔓 | Real platform counts for the landing page (cached 5 min) |
| GET | `/share/:token` | 🔓 | Read-only medical summary shared with a doctor |

## Auth — `/auth`

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| POST | `/register` | 🔓 | `{ name, email, password, phone?, role: PATIENT\|CAREGIVER\|DOCTOR\|PHARMACY, organization?, licenseNumber?, specialty? }` — organization + licence required for DOCTOR/PHARMACY → sends OTP, logs in |
| POST | `/login` | 🔓 | `{ email, password }` (5 failures → 15 min lock) |
| POST | `/refresh` | 🔓 | cookie or `{ refreshToken }` — rotates refresh token |
| POST | `/logout` | 🔓 | revokes the current session |
| POST | `/verify-email` | 🔓 | `{ email, code }` |
| POST | `/resend-otp` | 🔓 | `{ email, purpose: EMAIL_VERIFY\|PASSWORD_RESET }` (60 s cooldown) |
| POST | `/forgot-password` | 🔓 | `{ email }` |
| POST | `/reset-password` | 🔓 | `{ email, code, password }` — logs out all devices |
| GET | `/me` | 🔐 | Current user |
| PATCH | `/change-password` | 🔐 | `{ currentPassword, newPassword }` |
| GET | `/sessions` | 🔐 | Active devices |
| DELETE | `/sessions` | 🔐 | Log out all other devices |
| DELETE | `/sessions/:id` | 🔐 | Revoke one device |

## Users — `/users`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/me` | 🔐 | Profile |
| PATCH | `/me` | 🔐 | `{ name?, phone?, dateOfBirth?, gender?, bloodGroup?, allergies?, chronicConditions?, emergencyContact?, organization?, licenseNumber?, specialty?, address? }` — changing the licence number clears `isProVerified` |
| PATCH | `/me/preferences` | 🔐 | `{ language?, largeFont?, voiceEnabled?, timezone?, honorific?, smsEnabled?, callEnabled? }` |
| POST | `/me/test-alert` | 🔐 | Sends a test SMS (and a call if enabled) to the saved phone |
| POST | `/me/avatar` | 🔐 | multipart `image` |
| POST | `/me/share-link` | 🔐 | `{ expiresInDays: 1\|7\|30\|null }` |
| DELETE | `/me/share-link` | 🔐 | Disable doctor link |
| DELETE | `/me` | 🔐 | `{ password }` — delete account |
| GET | `/dashboard` | 🔐 🧑‍⚕️ | Today's doses, 7-day adherence, counts, expiring items |

## Prescriptions — `/prescriptions` 🔐 🧑‍⚕️

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | `?page&limit&search&status` — history, newest first |
| POST | `/` | ✉️ multipart `image`, `title?` — upload → Cloudinary → **AI OCR**; returns draft medicines |
| GET | `/:id` | Detail with medicines + reminders |
| PATCH | `/:id` | Update doctor / hospital / date / diagnosis / advice / notes |
| POST | `/:id/confirm` | `{ ...metadata, medicines: [{ name, strength?, mealTiming, durationDays?, reminders: [{ time, quantity, daysOfWeek }] }] }` — verifies and starts reminders |
| POST | `/:id/reprocess` | ✉️ Re-run AI on the stored image |
| DELETE | `/:id` | Delete (drafts removed, confirmed medicines kept) |

## Medicines — `/medicines` 🔐 🧑‍⚕️

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | `?active=true&search=` |
| POST | `/` | `{ name, genericName?, strength?, form?, dosagePattern?, instructions?, instructionsBn?, mealTiming, durationDays?, startDate?, endDate?, reminders: [...] }` |
| GET | `/:id` | Detail |
| PATCH | `/:id` | Partial update; `reminders` array is synced (history-preserving); `isActive` pauses/resumes |
| DELETE | `/:id` | Delete with history |

## Doses — `/doses` 🔐 🧑‍⚕️

| Method | Path | Description |
| --- | --- | --- |
| GET | `/today` | Today's doses in the patient's timezone + summary + next dose |
| GET | `/history` | `?from&to` (max 3 months) |
| GET | `/stats` | `?days=30` — adherence %, streak, daily series, by medicine, by time of day |
| PATCH | `/:id` | `{ status: TAKEN\|SKIPPED\|PENDING }` (within −48 h … +2 h) |

## Medicine cabinet — `/cabinet` 🔐 🧑‍⚕️

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | `?status=all\|active\|expiring\|expired\|disposed` + summary |
| POST | `/scan` | ✉️ multipart `image` — **AI reads name, batch, expiry** (returns uploaded image URL) |
| POST | `/` | `{ name, expiryDate, manufactureDate?, batchNumber?, quantity?, imageUrl?, imagePublicId?, notes? }` |
| PATCH | `/:id` | Partial update, `isDisposed` |
| DELETE | `/:id` | Remove |

## Care network — `/care` 🔐

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/caregivers` | PATIENT | My caregivers (pending + active) |
| POST | `/caregivers` | PATIENT ✉️ | `{ email, relation? }` — invite (Free: 2, Premium: 10) |
| DELETE | `/caregivers/:id` | PATIENT | Revoke access |
| GET | `/invites` | CAREGIVER | Pending invitations for my email |
| POST | `/invites/:id/respond` | CAREGIVER ✉️ | `{ accept: boolean }` |
| GET | `/patients` | CAREGIVER | My patients with today's progress & missed doses |
| GET | `/patients/:patientId` | CAREGIVER, ADMIN | Full overview: profile, today, 7-day stats, medicines, expiring items |
| PATCH | `/patients/:patientId/alerts` | CAREGIVER | `{ phone?, smsEnabled?, callEnabled? }` — set up SMS / call alerts for an elder |

## Issued prescriptions (doctor / pharmacy) — `/issued` 🔐 👤 DOCTOR, PHARMACY

Doctors and pharmacies cannot read patient records; they only see prescriptions they issued.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | `?page&limit&search` — issued list + stats |
| POST | `/` | ✉️ `{ patientName, patientAge?, patientGender?, patientPhone?, diagnosis?, advice?, followUpDate?, items: [{ name, strength?, dosageForm?, instructions?, mealTiming, durationDays?, reminders }] }` → `{ code, claimUrl, expiresAt }` (90 days) |
| POST | `/scan` | PHARMACY ✉️ multipart `image` — 🤖 reads a paper prescription into editable items |
| GET | `/:id` | One issued prescription |
| DELETE | `/:id` | Only while unclaimed |
| POST | `/:id/send` | `{ email }` — existing patient account: added directly + notified; otherwise the QR link is emailed |

## Claim a prescription — `/claim`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/:code` | 🔓 | Preview: issuer (verified or not), patient name, diagnosis, medicines |
| POST | `/:code` | 🔐 PATIENT | Adds it to the account with medicines + reminders (doctor → VERIFIED, pharmacy → needs review). Same patient again → 200; another account → 409 |

## Notifications — `/notifications`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/push/config` | 🔓 | VAPID public key |
| GET | `/` | 🔐 | `?page&limit&unread=true` |
| GET | `/unread-count` | 🔐 | Badge count |
| GET | `/speakable` | 🔐 | `?minutes=15` — recent unread items with a Bangla voice line |
| PATCH | `/read-all` | 🔐 | Mark all read |
| PATCH | `/:id/read` | 🔐 | Mark one read |
| DELETE | `/:id` | 🔐 | Delete |
| POST | `/push/subscribe` | 🔐 | Browser `PushSubscription` JSON |
| DELETE | `/push/subscribe` | 🔐 | `{ endpoint }` |

## AI — `/ai` 🔐 (rate limited 15/min)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/usage` | Monthly scan quota usage |
| POST | `/medicine-info` | ✉️ `{ name, language? }` — explainer (cached) |
| POST | `/interactions` | ✉️ 🧑‍⚕️ `{ medicines?: string[], language? }` — checks active medicines + extras vs allergies/conditions |
| GET | `/chat` | Chat history |
| POST | `/chat` | ✉️ `{ message, language? }` — assistant reply (context: current medicines) |
| DELETE | `/chat` | Clear conversation |
| POST | `/adherence-insight` | ✉️ 🧑‍⚕️ `{ language? }` — AI analysis of last 30 days |

## Payments — `/payments` (SSLCommerz)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/plans` | 🔓 | Plans and prices (BDT) |
| GET | `/me` | 🔐 | My payment history |
| POST | `/init` | 🔐 ✉️ PATIENT/CAREGIVER | `{ months: 1\|6\|12 }` → `{ gatewayUrl, tranId }` |
| POST | `/success/:tranId` | gateway | Validates `val_id` server-side, activates Premium, redirects to frontend |
| POST | `/fail/:tranId` · `/cancel/:tranId` | gateway | Marks payment and redirects |
| POST | `/ipn` | gateway | Instant payment notification (idempotent) |

## Admin — `/admin` 🔐 👤 ADMIN

| Method | Path | Description |
| --- | --- | --- |
| GET | `/stats` | Users, prescriptions, adherence, AI usage/latency, revenue, 30-day series |
| GET | `/users` | `?page&search&role&status` |
| PATCH | `/users/:id` | `{ role?, status?, plan?, planExpiresAt? }` (suspension revokes sessions) |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/force-logout` | Revoke all sessions |
| GET | `/prescriptions` | Moderation list `?page&search&status` |
| DELETE | `/prescriptions/:id` | `{ reason? }` — remove upload (audited) |
| GET | `/payments` | `?page&search&status` |
| GET | `/ai-logs` | `?page&feature&status=success\|failed` |
| GET | `/audit-logs` | Admin action trail |
| POST | `/broadcast` | `{ title, message, role? }` — system notification |

# SmartMed — ERD & Database Schema

PostgreSQL, managed with **Prisma v7** (`prisma/schema.prisma`). The diagram renders on GitHub (Mermaid).
Every table uses a `cuid` string primary key and `createdAt`/`updatedAt` timestamps.

```mermaid
erDiagram
    User ||--o{ Session : "logs in with"
    User ||--o{ OtpToken : "verifies with"
    User ||--o{ Prescription : uploads
    User ||--o{ Medicine : takes
    User ||--o{ Reminder : has
    User ||--o{ DoseLog : records
    User ||--o{ InventoryItem : "keeps at home"
    User ||--o{ Notification : receives
    User ||--o{ PushSubscription : "subscribes devices"
    User ||--o{ AiInteraction : "uses AI"
    User ||--o{ ChatMessage : chats
    User ||--o{ Payment : pays
    User ||--o{ CareLink : "is patient in"
    User |o--o{ CareLink : "is caregiver in"
    User |o--o{ AuditLog : "acts in (admin)"
    Prescription |o--o{ Medicine : contains
    Medicine ||--o{ Reminder : "scheduled by"
    Medicine ||--o{ DoseLog : "dose of"
    Reminder ||--o{ DoseLog : generates
    User ||--o{ IssuedPrescription : "issues (doctor / pharmacy)"
    User |o--o{ IssuedPrescription : claims
    IssuedPrescription |o--o| Prescription : "becomes"

    User {
        string id PK
        string name
        string email UK
        string phone
        string passwordHash
        enum role "PATIENT | CAREGIVER | ADMIN | DOCTOR | PHARMACY"
        enum status "ACTIVE | SUSPENDED"
        boolean isEmailVerified
        enum language "bn | en"
        boolean largeFont
        boolean voiceEnabled
        boolean smsEnabled
        boolean callEnabled
        string organization "hospital / pharmacy"
        string licenseNumber "BMDC / drug licence"
        string specialty
        boolean isProVerified "checked by admin"
        string timezone
        string honorific "e.g. দাদু"
        datetime dateOfBirth
        string bloodGroup
        string[] allergies
        string[] chronicConditions
        enum plan "FREE | PREMIUM"
        datetime planExpiresAt
        string shareToken UK
        datetime shareExpiresAt
        int failedLoginAttempts
        datetime lockedUntil
    }
    Session {
        string id PK
        string userId FK
        string tokenHash UK "sha256 of refresh token"
        string userAgent
        string ip
        datetime expiresAt
        datetime revokedAt
    }
    OtpToken {
        string id PK
        string userId FK
        enum purpose "EMAIL_VERIFY | PASSWORD_RESET"
        string codeHash "bcrypt"
        int attempts
        datetime expiresAt
        datetime consumedAt
    }
    CareLink {
        string id PK
        string patientId FK
        string caregiverId FK "null until accepted"
        string inviteEmail
        string relation
        enum status "PENDING | ACCEPTED | REJECTED | REVOKED"
    }
    Prescription {
        string id PK
        string patientId FK
        string imageUrl "Cloudinary, null for QR prescriptions"
        enum source "UPLOAD | DOCTOR | PHARMACY"
        string doctorName
        string hospital
        datetime prescribedDate
        string diagnosis
        text rawText "AI transcription"
        text aiSummaryBn
        float aiConfidence
        enum status "PROCESSING | PROCESSED | VERIFIED | FAILED"
    }
    Medicine {
        string id PK
        string patientId FK
        string prescriptionId FK
        string name
        string genericName
        string strength
        string dosagePattern "1+0+1"
        string instructionsBn
        enum mealTiming "BEFORE_MEAL | AFTER_MEAL | WITH_MEAL | ANY"
        int durationDays
        datetime startDate
        datetime endDate
        boolean isActive
    }
    Reminder {
        string id PK
        string medicineId FK
        string patientId FK
        string time "HH:mm local"
        int[] daysOfWeek "empty = daily"
        string quantity
        boolean isActive
    }
    DoseLog {
        string id PK
        string reminderId FK
        string medicineId FK
        string patientId FK
        datetime scheduledFor "UK with reminderId"
        enum status "PENDING | TAKEN | MISSED | SKIPPED"
        datetime takenAt
        datetime notifiedAt
        datetime caregiverAlertedAt
    }
    InventoryItem {
        string id PK
        string patientId FK
        string name
        string batchNumber
        datetime expiryDate
        int quantity
        string imageUrl
        boolean isDisposed
        datetime expiryAlertSentAt
    }
    Notification {
        string id PK
        string userId FK
        enum type "DOSE_REMINDER | MISSED_DOSE | EXPIRY_ALERT | CARE_INVITE | PAYMENT | SYSTEM"
        string title
        string message
        string speakText "Bangla voice line"
        json data
        boolean isRead
    }
    PushSubscription {
        string id PK
        string userId FK
        string endpoint UK
        string p256dh
        string auth
    }
    AiInteraction {
        string id PK
        string userId FK
        enum feature "PRESCRIPTION_OCR | EXPIRY_SCAN | MEDICINE_INFO | INTERACTION_CHECK | HEALTH_CHAT | ADHERENCE_INSIGHT"
        string provider "gemini:model / groq:model"
        boolean success
        int latencyMs
    }
    ChatMessage {
        string id PK
        string userId FK
        enum role "USER | ASSISTANT"
        text content
    }
    Payment {
        string id PK
        string userId FK
        string tranId UK
        decimal amount
        int months
        enum status "PENDING | SUCCESS | FAILED | CANCELLED"
        string valId "SSLCommerz validation id"
        json gatewayResponse
    }
    IssuedPrescription {
        string id PK
        string code UK "random, in the QR"
        string issuerId FK
        enum source "DOCTOR | PHARMACY"
        string patientName
        int patientAge
        string patientPhone
        string diagnosis
        string advice
        json items "medicines + reminder pattern"
        string claimedById FK
        datetime claimedAt
        string prescriptionId FK UK
        datetime expiresAt
    }
    AuditLog {
        string id PK
        string actorId FK
        string action
        string targetType
        string targetId
        json meta
    }
```

## Key design decisions

| Decision | Why |
| --- | --- |
| `Reminder` (rule) and `DoseLog` (occurrence) are separate | A reminder says *when*; each day the scheduler materialises one `DoseLog` per reminder. History survives reminder edits, and `@@unique([reminderId, scheduledFor])` makes scheduling idempotent. |
| Reminder `time` stored as local `HH:mm` + `User.timezone` | Patients think in local time. UTC instants are computed per day, so a caregiver abroad sees the same schedule. |
| AI-extracted medicines are **drafts** until the prescription is `VERIFIED` | Handwriting OCR can be wrong; reminders only start after the patient confirms. |
| `CareLink.inviteEmail` + nullable `caregiverId` | A patient can invite someone who has no account yet; the link attaches when they sign up and accept. |
| Refresh tokens stored only as SHA-256 hashes in `Session` | A database leak does not leak usable sessions; rotation on every refresh; per-device logout. |
| `AiInteraction` log | Powers the free-plan quota, admin AI monitoring and failure debugging. |
| `AuditLog` | Every admin moderation action is traceable. |
| `IssuedPrescription` is separate from `Prescription` | A doctor writes it before any patient account is known. The unguessable `code` in the QR lets exactly one patient claim it (`claimedAt` guarded update); claiming copies it into a normal `Prescription` so the rest of the app needs no special case. Issuers never get read access to patient records. |

## Indexes

Hot paths are indexed: `DoseLog(patientId, scheduledFor)`, `DoseLog(status, scheduledFor)` (missed-dose job),
`InventoryItem(expiryDate, isDisposed)` (expiry job), `Notification(userId, isRead, createdAt)`,
`Reminder(patientId, isActive)`, `AiInteraction(userId, feature, createdAt)` (quota).

The full SQL is in `prisma/migrations/` (`20261012000000_init`, then additive migrations such as `20261029000000_issued_prescriptions_and_sms`).

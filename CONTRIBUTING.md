# Contributing to SmartMed

SmartMed is split into two repositories that are developed together:

- **backend** — Express API, database, background jobs and all project docs (`docs/`)
- **frontend** — Next.js web app

The same rules apply to both.

## Branches

| Branch | Purpose | Who merges |
| --- | --- | --- |
| `main` | Production. Every push deploys (Render / Vercel). Always stable. | Team lead, via release PR |
| `develop` | Integration branch for the current sprint | Any member, after review |
| `feature/<card-id>-short-name` | One board card, e.g. `feature/SM-21-qr-claim` | — |
| `fix/<card-id>-short-name` | Bug fix, e.g. `fix/SM-40-upload-preview` | — |
| `hotfix/<short-name>` | Urgent production fix, branched from `main`, merged into `main` **and** `develop` | Team lead |

Protect `main` and `develop` on GitHub (Settings → Branches): require a pull request, 1 approving review and the **CI** check to pass.

## Daily flow

```bash
git checkout develop && git pull
git checkout -b feature/SM-21-qr-claim
# …work, commit small and often…
git push -u origin feature/SM-21-qr-claim
# open a PR into develop, fill in the template, move the card to "In review"
```

At the end of each MVP sprint the lead opens a **release PR `develop → main`**, the team checks the live preview, and it is merged and tagged (`v0.1.0` MVP 01, `v0.2.0` MVP 02, `v1.0.0` MVP 03).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): what changed`

```
feat(issued): patient can claim a doctor's QR prescription
fix(upload): keep image preview alive under React Strict Mode
docs(api): document /claim endpoints
refactor(care): reuse PatientAlertsCard in overview
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`. One logical change per commit; aim for **10+ meaningful commits per member per week**.

## Pull request rules

- Small PRs (under ~400 changed lines) get reviewed faster.
- Fill in the PR template, link the board card (`Closes #12`).
- At least **one review** from another member. The reviewer checks: works as described, validation and error handling, no secrets, UI in Bangla + English, mobile layout.
- Resolve every review comment (fix it or reply why not) before merging.
- Use **Squash and merge** into `develop` so history stays readable.

## Code standards

- **Backend (MVC):** route → middleware (auth, role, Zod validation) → controller (HTTP only) → service (business rules) → model (Prisma queries). No database calls in controllers.
- **Frontend:** pages in `src/app` stay thin; feature code lives in `src/features/<feature>` (`api.ts` hooks + components); shared UI in `src/components`.
- Validate every request body, query and param with Zod; throw `ApiError` for expected failures.
- Every screen that loads data shows loading, empty and error states.
- Secrets only in `.env` (never committed). Add new variables to `.env.example` and `render.yaml`.
- No dummy data: every list comes from the API.
- Database changes: edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>`, commit the migration folder. Never edit an applied migration.

## Before you push

```bash
npm run typecheck
npm run build
npm run lint        # frontend
```

CI runs the same checks on every PR.

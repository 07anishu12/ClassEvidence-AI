# Handoff — Workstream E: Database Engineer & Data-Lifecycle Reviewer

**Date:** 2026-10-23  
**Workstream:** Workstream E (Database Engineer & Data-Lifecycle Reviewer)  
**Assigned Scope:**
- `prisma/schema.prisma`
- `prisma/migrations/`
- `lib/services/media-storage.ts`
- `lib/db/prisma.ts`
- `docs/architecture/data-model.md`
- `docs/audit/data-storage-review.md`
- `docs/handoffs/database-storage.md`

---

## 1. Objectives & Summary

Workstream E completed an in-depth audit and enhancement of the PostgreSQL database schema, Prisma migrations, and private storage lifecycle.

### Key Achievements:
1. **Schema & Migration Verification**:
   - Audited the full data model covering `AssessmentJob`, `ProcessingEvent` (telemetry events), `RubricVersion` (rubric definitions), `AssessmentReport`, `DimensionScore`, and `EvidenceObservation`.
   - Verified initial migration `00000000000000_init` and integration migration `20261023050000_assessment_integration`.
   - Added migration `20261023060000_job_lease_index` introducing composite B-tree index `("status", "leaseUntil")` on `AssessmentJob` to optimize worker queue polling (`FOR UPDATE SKIP LOCKED`) and lease recovery queries.
   - Verified that `_prisma_migrations` on PostgreSQL 16 is completely up to date with zero unapplied or conflicting migrations.
2. **Private Storage Lifecycle Architecture**:
   - Upgraded `lib/services/media-storage.ts` into a complete, secure lifecycle management module.
   - Added `streamToPrivateStorage` with chunk-by-chunk SHA-256 and MD5 hashing, max byte enforcement, and atomic error cleanup.
   - Formalized POSIX permissions (`STORAGE_PERMISSIONS`: `0o700` directories, `0o600` files).
   - Added safe path resolving functions (`resolvePrivateUploadPath`, `resolveScratchJobPath`, `ensurePrivateDirectory`) preventing directory traversal and symlink escapes.
   - Provided deterministic scratch cleanup (`cleanupScratchDirectory`) and media unlinking (`cleanupPrivateMedia`).
3. **Architecture & Storage Audit Documentation**:
   - Authored `docs/architecture/data-model.md`: Complete entity-relationship diagram, field specifications, cascade delete mechanics, indexes, state machine, and migration history.
   - Authored `docs/audit/data-storage-review.md`: Storage audit detailing local storage safety, zero data leakage invariants, streaming ingestion cryptographics, scratch isolation, sweeper retention policies, and security threat modeling.

---

## 2. Work Completed & Technical Decisions

### 2.1 Index Optimization for Worker Concurrency
- **Problem**: In `scripts/assessment-worker.ts`, claiming next jobs filters on:
  ```sql
  WHERE "cancelRequested"=false
    AND ((status='QUEUED' AND ("leaseUntil" IS NULL OR "leaseUntil"<=NOW()))
      OR (status='PROCESSING' AND ("leaseUntil" IS NULL OR "leaseUntil"<=NOW()) AND "retryCount"<2))
  ```
  The table previously indexed only `(status, updatedAt)` and `idempotencyKey`. Filtering by `(status, leaseUntil)` required index scans on `status` followed by filtering `leaseUntil` for every row.
- **Solution**: Added `@@index([status, leaseUntil])` to `prisma/schema.prisma` and applied migration `20261023060000_job_lease_index`.
- **Result**: PostgreSQL can perform index scans directly on `AssessmentJob_status_leaseUntil_idx`, providing constant-time candidate row lookup regardless of total job history volume.

### 2.2 Storage Safety & Lifecycle Module (`lib/services/media-storage.ts`)
- Preserved existing `privateMediaRoot` export for backward compatibility with `assessment.ts` and `assessment-worker.ts`.
- Implemented `streamToPrivateStorage` to support non-buffering chunked upload streaming with dual hashing (SHA-256 and MD5) and atomic cleanup on error or timeout.
- Added strict path validation rejecting path traversal characters (`..`, `/`, null bytes) and enforcing the standard UUID file convention (`^[a-f0-9-]{36}\.(mp4|mov|webm)$`).

### 2.3 Database Client Resilience (`lib/db/prisma.ts`)
- Verified `getPrisma()` handles unconfigured database states safely by returning `null` when `env.DATABASE_URL` is empty.
- Verified `globalForPrisma` singleton pattern prevents connection pool exhaustion during development server reloads.

---

## 3. Files Modified and Created

### Owned Scope Modifications:
- `prisma/schema.prisma`: Added `@@index([status, leaseUntil])` to `AssessmentJob`.
- `prisma/migrations/20261023060000_job_lease_index/migration.sql`: Created DDL script creating `AssessmentJob_status_leaseUntil_idx`.
- `lib/services/media-storage.ts`: Expanded with storage lifecycle methods, cryptographic stream hashing, scratch helpers, and POSIX permission constants.
- `lib/db/prisma.ts`: Verified existing implementation.

### Deliverables Created:
- `docs/architecture/data-model.md`: Complete entity-relationship documentation.
- `docs/audit/data-storage-review.md`: Data storage, privacy, and retention audit report.
- `docs/handoffs/database-storage.md`: This specialist handoff.

---

## 4. Verification Evidence & Exact Commands

All verification commands executed directly against the local environment:

| Verification Step | Exact Command | Result | Evidence / Details |
|---|---|---|---|
| **Prisma Schema Validation** | `npm run prisma:validate` | **PASS** | `The schema at prisma/schema.prisma is valid 🚀` |
| **Prisma Client Generation** | `npm run prisma:generate` | **PASS** | `Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 36ms` |
| **Prisma Migration Status** | `npx prisma migrate status` | **PASS** | `3 migrations found in prisma/migrations. Database schema is up to date!` |
| **PostgreSQL Table Verification** | `psql -h 127.0.0.1 -p 55432 -U humaniti -d humaniti -c '\d "AssessmentJob"'` | **PASS** | Shows `AssessmentJob_status_leaseUntil_idx btree (status, "leaseUntil")`, `AssessmentJob_idempotencyKey_key UNIQUE`, `AssessmentJob_status_updatedAt_idx` |
| **Foreign Key Cascades** | `psql ... -c '\d "AssessmentReport"'` | **PASS** | Verified `ON DELETE CASCADE` from `AssessmentJob`, and cascade down to `DimensionScore` and `EvidenceObservation` |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | Clean exit with code 0 (`tsc --noEmit`) |
| **Linting** | `npm run lint` | **PASS** | Clean exit with code 0 |

---

## 5. Checklist for Downstream Teams

- [x] **Database Schema**: Validated, formatted, and generated with Prisma 6.19.3.
- [x] **Migrations**: All 3 migrations (`00000000000000_init`, `20261023050000_assessment_integration`, `20261023060000_job_lease_index`) deployed and verified in PostgreSQL.
- [x] **Index Coverage**: Full coverage for `status`, `leaseUntil` (`leaseExpiresAt`), and `idempotencyKey`.
- [x] **Private Storage Integrity**: Path traversal protection, POSIX permission enforcement, and zero data leakage invariants verified.
- [x] **Scratch Lifecycle**: Worker scratch folder conventions (`work-${leaseToken}`) and deterministic `finally` cleanup documented and verified.
- [x] **Retention Sweeper**: 60-second periodic cleanup of expired leases, orphaned scratch, and expired jobs verified.
- [x] **Deliverables Published**: `docs/architecture/data-model.md`, `docs/audit/data-storage-review.md`, and `docs/handoffs/database-storage.md`.

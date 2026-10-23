# Backend Architecture & API Contract Review

**Date:** 2026-10-23  
**Reviewer:** Workstream B — Senior Backend Engineer & API Contract Owner  
**Scope:** HTTP API Gateway (`/api/*`), Domain Contracts (`lib/contracts/*`), Assessment Service (`lib/services/assessment.ts`)

---

## 1. Executive Summary

This review establishes the API gateway contracts, validation boundaries, idempotency protocols, access controls, rate limiting, and typed error handling for the Humaniti AI assessment engine.

The backend exposes a secure, private REST API implemented with Next.js App Router (Node.js runtime), PostgreSQL backing store via Prisma ORM, strict Zod runtime type assertion, and defense-in-depth isolation against SSRF, unauthenticated access, denial-of-service, and resource leakage.

---

## 2. Endpoint Contracts & Specifications

### 2.1 Summary Matrix

| Method | Endpoint | Description | Auth Required | Cache Header | Success Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service and database health check | No | `no-store` | `200 OK` / `503 Service Unavailable` |
| `POST` | `/api/assessments` | Submit a recording for processing | Bearer + Consent | `no-store` | `202 Accepted` / `200 OK` (Reused) / `409 Conflict` |
| `GET` | `/api/assessments` | List assessment history (paginated) | Bearer | `no-store` | `200 OK` |
| `GET` | `/api/assessments/:id` | Get status and progress of assessment | Bearer | `no-store` | `200 OK` |
| `PATCH` | `/api/assessments/:id` | Cancel an in-flight assessment | Bearer (Mutation) | `no-store` | `200 OK` |
| `DELETE` | `/api/assessments/:id` | Delete completed or failed assessment | Bearer (Mutation) | `no-store` | `200 OK` |
| `GET` | `/api/assessments/:id/report` | Fetch verified coaching report | Bearer | `no-store` | `200 OK` |

---

### 2.2 Endpoint Details

#### `GET /api/health`
- **Purpose:** Infrastructure liveness and readiness probe for load balancers and orchestrators.
- **Request Headers:** None required.
- **Success Response (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "humaniti-ai",
    "database": "ok",
    "provider": "blocked"
  }
  ```
- **Degraded Response (503 Service Unavailable):**
  ```json
  {
    "status": "degraded",
    "service": "humaniti-ai",
    "database": "unavailable",
    "provider": "blocked"
  }
  ```

#### `POST /api/assessments`
- **Purpose:** Ingests a private video recording stream (`video/mp4`, `video/quicktime`, `video/webm`) or records idempotent submission.
- **Request Headers:**
  - `Authorization: Bearer <ASSESSMENT_ACCESS_TOKEN>` (Required)
  - `Content-Type: video/mp4` | `video/quicktime` | `video/webm`
  - `X-Recording-Consent: true` (Required)
  - `Idempotency-Key: <string>` or `X-Idempotency-Key: <string>` (Optional, 1–256 chars)
  - `Origin: <APP_ORIGIN>` (Validated on mutations)
- **Request Body:** Binary media stream (up to `MAX_UPLOAD_BYTES`, default 2 GiB).
- **Responses:**
  - **New Job Created (202 Accepted):**
    ```json
    {
      "id": "cuid_xyz123",
      "status": "queued"
    }
    ```
  - **Duplicate Submission — Existing In-Flight/Completed (200 OK):**
    ```json
    {
      "id": "cuid_xyz123",
      "status": "queued",
      "reused": true
    }
    ```
  - **Duplicate Submission — Existing Failed (409 Conflict):**
    ```json
    {
      "id": "cuid_xyz123",
      "status": "failed",
      "reused": true
    }
    ```

#### `GET /api/assessments`
- **Purpose:** Cursor-paginated listing of user assessments.
- **Query Parameters:**
  - `cursor` (Optional string, CUID/UUID format)
- **Response (200 OK):**
  ```json
  {
    "assessments": [
      {
        "id": "cuid_1",
        "status": "completed",
        "stage": "completed",
        "createdAt": "2026-10-23T20:00:00.000Z",
        "qualityLabel": "Good"
      }
    ],
    "nextCursor": null
  }
  ```

#### `GET /api/assessments/:id`
- **Purpose:** Query real-time status, execution stage, error codes, and report availability.
- **Security:** Redacts internal file paths (`sourceRef`, storage locators).
- **Response (200 OK):**
  ```json
  {
    "id": "cuid_1",
    "status": "processing",
    "progress": 45,
    "stage": "analysis",
    "error": null,
    "createdAt": "2026-10-23T20:00:00.000Z",
    "updatedAt": "2026-10-23T20:01:15.000Z",
    "hasReport": false
  }
  ```

#### `PATCH /api/assessments/:id`
- **Purpose:** Cancel a queued or active assessment job.
- **Request Body (Bounded <= 100 bytes):**
  ```json
  {
    "action": "cancel"
  }
  ```
- **Responses:**
  - `200 OK`: `{"ok": true}`
  - `409 Conflict`: If job is already terminal (`COMPLETED` or `FAILED`), or if retry was requested.

#### `DELETE /api/assessments/:id`
- **Purpose:** Purge terminal assessment records and clean up staged disk media.
- **Responses:**
  - `200 OK`: `{"ok": true}`
  - `409 Conflict`: If job is currently active (`QUEUED` or `PROCESSING`), returns `{ "error": "Active assessments cannot be deleted.", "code": "invalid_state" }`.

#### `GET /api/assessments/:id/report`
- **Purpose:** Retrieve the full coaching breakdown, pedagogical rubric scores, observations, and recommendations.
- **Responses:**
  - `200 OK`: Validated `Report` JSON conforming to `reportSchema`.
  - `409 Conflict`: `{ "error": "A report is not available yet.", "code": "report_unavailable" }`.

---

## 3. Idempotency Architecture (P1)

### 3.1 Motivation
In unreliable network environments, clients uploading large class recordings frequently encounter socket disconnects or retried form submissions. Without idempotency, duplicate jobs waste heavy GPU/CPU resources, incur double compute cost, and clutter assessment history.

### 3.2 Protocol & Mechanics
1. **Key Extraction:**
   - Evaluates `Idempotency-Key` or `X-Idempotency-Key` header (1–256 characters, alphanumeric plus `_ . : -`).
   - If `Content-Type: application/json` is provided, also inspects payload `idempotencyKey`.
2. **Pre-flight Database Check:**
   - Before accepting multi-megabyte streams or opening disk file descriptors, queries `db.assessmentJob.findUnique({ where: { idempotencyKey } })`.
   - If found:
     - If `status === "FAILED"`: Returns `409 Conflict` with `{ id, status: "failed", reused: true }`.
     - Otherwise: Returns `200 OK` with `{ id, status, reused: true }`.
3. **Race Condition Arbitration:**
   - If two requests with the same idempotency key arrive concurrently before either commits, PostgreSQL unique constraint on `idempotencyKey` triggers Prisma error `P2002`.
   - The worker catches `P2002`, discards the temporary media file (`await rm(path, { force: true })`), re-queries the winning job record, and returns the existing job (`reused: true`).

---

## 4. Access Control & Authorization (P0)

1. **Bearer Token Authentication:**
   - Evaluated by `authorize(request, mutation?: boolean)`.
   - Environment variable `ASSESSMENT_ACCESS_TOKEN` is mandatory; if unconfigured, returns `503 auth_unconfigured`.
   - Uses `crypto.timingSafeEqual` over SHA-256 digests of expected and received tokens to eliminate timing-attack side channels:
     ```ts
     timingSafeEqual(
       createHash("sha256").update(actual).digest(),
       createHash("sha256").update(expected).digest()
     )
     ```
2. **Mutation Protections:**
   - Mutation endpoints (`POST /api/assessments`, `PATCH /api/assessments/:id`, `DELETE /api/assessments/:id`) verify `Origin` header against `env.APP_ORIGIN`.
   - Requests with mismatched or foreign origins are rejected with `403 origin_rejected`.
3. **Explicit Consent Gate:**
   - Ingestion requires `X-Recording-Consent: true` to prevent unauthorized recording uploads.

---

## 5. SSRF & URL Validation Defenses (P1)

The URL contract in `lib/contracts/assessment.ts` implements multi-layer SSRF defenses:

1. **Protocol:** Strict `https:` only. Plaintext `http:`, `file:`, `gopher:`, `ftp:` are rejected.
2. **Credentials & Hash:** URLs containing embedded basic auth (`user:pass@host`) or hash fragments (`#fragment`) are rejected.
3. **Port Enforcement:** Only default HTTPS (`443`) and standard alt-HTTPS (`8443`) are permitted. Custom high/low ports (e.g. `6379`, `22`, `5432`) are blocked.
4. **Host Blacklisting (`isDisallowedHost`):**
   - **Loopback:** `localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`, `[::ffff:127.0.0.1]`.
   - **Link-Local & Cloud Metadata:** `169.254.0.0/16` (including `169.254.169.254`), `metadata.google.internal`, `instance-data`, `metadata`.
   - **Private Subnets (RFC 1918):** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
   - **Carrier-Grade NAT (RFC 6598):** `100.64.0.0/10`.
   - **Benchmarking & Documentation (RFC 5737/2544):** `198.18.0.0/15`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`.
   - **Internal Domains:** `*.internal`, `*.local`, `*.lan`, `*.home.arpa`, `*.cluster.local`.
   - **Single-Label Hosts:** Any host without a dot (`!host.includes(".")`) is rejected.
   - **IPv6 Literals:** All IPv6 literal IP hosts are blocked.

---

## 6. Rate Limiting, Timeouts, and Resource Bounds

1. **Intake Rate Limiting:**
   - In-memory sliding window allows up to 6 assessment mutation requests per minute.
   - Exceeded rate limits return `429 rate_limited` with standard `Retry-After: 60` response header.
2. **Payload & Stream Bounds:**
   - Stream upload enforced against `env.MAX_UPLOAD_BYTES` (default 2 GiB).
   - Chunk-level tracking aborts file writer and cancels stream if exceeded, returning `413 upload_too_large`.
   - Magic byte header inspection validates `ftyp` (MP4/MOV) and EBML `0x1A45DFA3` (WebM) signatures.
   - Intake stream has a strict 120-second timeout deadline; PATCH action bodies enforce 5-second deadline and 100-byte cap.

---

## 7. Typed Error Contracts

All errors returned by the backend adhere to a predictable contract:

```ts
export const apiErrorSchema = z.object({
  error: z.string().min(1),
  code: z.string().min(1),
  message: z.string().optional(),
}).strict();
```

### Standard Status Code Mapping:
- **`400 Bad Request`:** `consent_required`, `invalid_job_id`, `invalid_action`, `invalid_json`, `invalid_idempotency_key`, `invalid_cursor`
- **`401 Unauthorized`:** `unauthorized` (Invalid or missing bearer token)
- **`403 Forbidden`:** `origin_rejected` (Mismatched Origin header)
- **`404 Not Found`:** `job_not_found`
- **`408 Request Timeout`:** `request_timeout`
- **`409 Conflict`:** `invalid_state`, `retry_unavailable`, `report_unavailable`
- **`413 Payload Too Large`:** `upload_too_large`, `request_too_large`
- **`415 Unsupported Media Type`:** `unsupported_media`, `invalid_media`
- **`422 Unprocessable Entity`:** `source_unavailable`, `source_integrity_failed`
- **`429 Too Many Requests`:** `rate_limited`
- **`503 Service Unavailable`:** `auth_unconfigured`, `database_unavailable`, `storage_unavailable`, `service_unavailable`

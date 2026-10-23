# Humaniti AI — Comprehensive Self-Hosting Guide

This guide provides end-to-end instructions for deploying, configuring, operating, and auditing **Humaniti AI** in a self-hosted or private cloud environment.

Humaniti AI is architected with a strict privacy-first, zero-leakage security posture designed specifically for analyzing classroom recordings without compromising student identity, video confidentiality, or proprietary teaching material.

---

## 1. Architecture Overview

Humaniti AI consists of four primary runtime components:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        User / Browser Client                            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS (Port 443 -> 3000)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Next.js App Router (Web & API Server)                 │
│  - Form & Media Ingestion Gateways                                      │
│  - Token Authentication & Access Control (ASSESSMENT_ACCESS_TOKEN)      │
│  - REST API (/api/health, /api/assessments, /api/assessments/[id])      │
└───────────────┬─────────────────────────────────────┬───────────────────┘
                │                                     │
                │ DB State & Queues                   │ Streaming Uploads
                ▼                                     ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│      PostgreSQL 16 DB          │  │       Private Storage Root         │
│  - AssessmentJob queue         │  │   (.private/media, chmod 0700)     │
│  - Lease tokens & heartbeats   │  │  - Source recordings (unlinked)    │
│  - ProcessingEvent audit log   │  │  - Ephemeral scratch workspaces    │
│  - Normalized Coaching Reports │  └─────────────────┬──────────────────┘
└───────────────▲────────────────┘                    │
                │ Lease Claim & Sync                  │ File Descriptors
┌───────────────┴─────────────────────────────────────┴───────────────────┐
│           Humaniti Assessment Worker Daemon (Node.js & TypeScript)      │
│  - SKIP LOCKED queue arbitration and distributed leasing                │
│  - Process group supervision (SIGKILL upon timeout/OOM)                 │
│  - Automatic cleanup of expired scratch workspaces and uploaded source  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Subprocess Execution (Bounded)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Private Python Media & Analysis Engine (worker/src)        │
│  - FFprobe container validation (codecs, dimensions, durations)         │
│  - Bounded FFmpeg mono PCM extraction (source_start_sec / duration)    │
│  - Offline ASR transcription (whisper-cli / local model)                │
│  - Evidence grounding & rubric scoring evaluation                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security & Privacy Invariants
1. **Blocked Outbound Traffic by Default**: The system operates with `ASSESSMENT_PROVIDER="blocked"` out of the box. No video frames, audio samples, or transcripts are sent to third-party cloud APIs.
2. **Ephemeral Media Storage**: Raw uploaded videos are stored in `PRIVATE_MEDIA_ROOT` under `0700` POSIX directory permissions. Upon job completion, cancellation, or failure, unlinked source video files are securely purged.
3. **Loopback Isolation**: The PostgreSQL container binds exclusively to `127.0.0.1:5432`, preventing external network intrusion.
4. **Subprocess Sandboxing**: All FFmpeg, ffprobe, and Python worker subprocesses run with bounded execution timeouts and POSIX resource limits (`RLIMIT_AS`, `RLIMIT_FSIZE`, `RLIMIT_CPU`).

---

## 2. System Prerequisites

### Hardware Requirements
| Resource | Minimum (Provider: Blocked / API only) | Recommended (Local Offline AI / Whisper) |
|---|---|---|
| **CPU** | 2 vCPUs (x86_64 or ARM64) | 8+ vCPUs (AVX2 support or Apple Silicon) |
| **RAM** | 4 GB | 16 GB - 32 GB (for local LLM & Whisper models) |
| **Storage** | 20 GB SSD | 100+ GB NVMe SSD (fast media I/O & models) |
| **Network** | Loopback / Internal LAN only | Internal LAN with optional reverse proxy |

### Operating System Support
- **Ubuntu**: 22.04 LTS or 24.04 LTS (recommended for production)
- **Debian**: 12 (Bookworm)
- **macOS**: Sonoma 14+ / Sequoia 15+ (Apple Silicon recommended for local development)
- **RHEL / Rocky Linux**: 9+

### Software Dependencies
- **Node.js**: `v20.x` or `v22.x LTS` (Node 22 LTS recommended)
- **Python**: `3.12.x` (with `venv` and `pip`)
- **FFmpeg**: `6.x` or `7.x` with `ffprobe`
- **Docker & Docker Compose**: v2.20+ (for PostgreSQL 16 container)
- **OpenSSL**: For generating access tokens

---

## 3. Step-by-Step Installation

### Step 3.1: Install System Packages

#### On Ubuntu / Debian:
```bash
sudo apt-get update && sudo apt-get install -y \
  curl \
  git \
  build-essential \
  ffmpeg \
  python3.12 \
  python3.12-venv \
  python3-pip \
  openssl

# Install Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### On macOS (Homebrew):
```bash
brew install node@22 python@3.12 ffmpeg docker docker-compose
brew link --overwrite node@22
```

Verify the tools:
```bash
node -v         # Expected: v20.x or v22.x
npm -v          # Expected: 10.x+
python3 -v      # Expected: Python 3.12.x
ffmpeg -version # Expected: ffmpeg version 6.x or 7.x
ffprobe -version
```

---

### Step 3.2: Clone the Repository & Configure Permissions

```bash
git clone https://github.com/humaniti-ai/humaniti-ai.git /opt/humaniti-ai
cd /opt/humaniti-ai

# Create the private media directory with strict 0700 permissions
mkdir -p .private/media
chmod 0700 .private/media
```

---

### Step 3.3: Environment Configuration

Copy the template configuration:
```bash
cp .env.example .env.local
```

Generate a cryptographically secure 64-character token for API protection:
```bash
openssl rand -hex 32
```

Edit `.env.local` to configure your values:
```bash
# ------------------------------------------------------------------------------
# Core Environment
# ------------------------------------------------------------------------------
NODE_ENV="production"
APP_ORIGIN="http://localhost:3000"

# ------------------------------------------------------------------------------
# Database
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://humaniti@localhost:5432/humaniti_ai?schema=public"

# ------------------------------------------------------------------------------
# Assessment Provider Policy (Default: blocked)
# ------------------------------------------------------------------------------
ASSESSMENT_PROVIDER="blocked"

# ------------------------------------------------------------------------------
# Access Control (Paste your generated 64-char token here)
# ------------------------------------------------------------------------------
ASSESSMENT_ACCESS_TOKEN="e9b2c8a14f7d98324e98f01b654321fedcba09876543210abcdef123456789ab"

# ------------------------------------------------------------------------------
# Private Media Storage & Quotas
# ------------------------------------------------------------------------------
PRIVATE_MEDIA_ROOT="./.private/media"
MAX_UPLOAD_BYTES="2147483648"
```

---

### Step 3.4: Install Node.js & Python Dependencies

```bash
# 1. Install Node.js production & dev dependencies
npm ci

# 2. Set up Python virtual environment for the media worker
python3 -m venv worker/.venv
source worker/.venv/bin/activate
pip install --upgrade pip
pip install -e "./worker[test]"
deactivate
```

---

## 4. Database Provisioning & Migrations

### Step 4.1: Start PostgreSQL via Docker Compose

Humaniti AI includes a preconfigured `compose.yaml` file binding PostgreSQL 16 strictly to `127.0.0.1:5432`:

```bash
docker compose up -d db
```

Verify that PostgreSQL is healthy:
```bash
docker compose ps
# Expected state: Up (healthy)
```

### Step 4.2: Apply Migrations & Generate Prisma Client

```bash
# Generate the strongly typed Prisma client
npm run prisma:generate

# Apply database migrations to PostgreSQL
npx prisma migrate deploy
```

---

## 5. Building and Running Services

### Step 5.1: Build Application Artifacts

Build both the Next.js production bundle and the TypeScript background assessment worker:

```bash
# Build Next.js web application
npm run build

# Compile TypeScript background worker into .worker-build/
npm run worker:build
```

---

### Step 5.2: Running the Stack for Local Self-Hosting

You need two long-running processes:
1. **Web Server** (Next.js App Router): Handles uploads, web UI, reports, and REST APIs.
2. **Assessment Worker** (Node + Python): Polls PostgreSQL queue, manages leases, runs FFmpeg, and executes scoring.

#### Terminal 1 — Start the Web Server:
```bash
npm start
# Server listening on http://localhost:3000
```

#### Terminal 2 — Start the Assessment Worker:
```bash
npm run worker:run
# Assessment worker listening for queued jobs...
```

---

## 6. Offline AI Runtimes (Local Ollama & Whisper)

To enable genuine offline video and audio evaluations without sending data to any external provider:

### Step 6.1: Set Up Local Whisper ASR
1. Download a quantized GGML Whisper model:
   ```bash
   mkdir -p /opt/models/whisper
   curl -L -o /opt/models/whisper/ggml-base.bin \
     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
   chmod 0600 /opt/models/whisper/ggml-base.bin
   ```
2. Ensure `whisper-cli` is compiled and available in your `$PATH`.

### Step 6.2: Set Up Local Ollama LLM
1. Install Ollama:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Pull the designated local model:
   ```bash
   ollama pull qwen3:4b
   ```

### Step 6.3: Activate Local Provider Mode in `.env.local`
Update `.env.local`:
```bash
ASSESSMENT_PROVIDER="local"
LOCAL_MODEL="qwen3:4b"
WHISPER_MODEL_PATH="/opt/models/whisper/ggml-base.bin"
```
Restart the worker process to apply the changes.

---

## 7. Production Process Management (systemd)

For robust Linux production deployments, configure `systemd` services with automatic restart and unprivileged users.

### Step 7.1: Create Dedicated Service User
```bash
sudo useradd -r -s /bin/false -d /opt/humaniti-ai humaniti
sudo chown -R humaniti:humaniti /opt/humaniti-ai
sudo chmod 0700 /opt/humaniti-ai/.private/media
```

### Step 7.2: Create Web Service Unit
`/etc/systemd/system/humaniti-web.service`:
```ini
[Unit]
Description=Humaniti AI Web Application (Next.js)
After=network.target docker.service

[Service]
Type=simple
User=humaniti
Group=humaniti
WorkingDirectory=/opt/humaniti-ai
EnvironmentFile=/opt/humaniti-ai/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=humaniti-web

# Security sandboxing
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Step 7.3: Create Worker Service Unit
`/etc/systemd/system/humaniti-worker.service`:
```ini
[Unit]
Description=Humaniti AI Assessment Worker Daemon
After=network.target docker.service humaniti-web.service

[Service]
Type=simple
User=humaniti
Group=humaniti
WorkingDirectory=/opt/humaniti-ai
EnvironmentFile=/opt/humaniti-ai/.env.local
ExecStart=/usr/bin/node .worker-build/scripts/assessment-worker.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=humaniti-worker

# Security sandboxing
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now humaniti-web humaniti-worker
sudo systemctl status humaniti-web humaniti-worker
```

---

## 8. Reverse Proxy & TLS Hardening (Nginx)

Place Nginx in front of Next.js to provide TLS termination, request buffering, and enforce strict upload limits.

Sample `/etc/nginx/sites-available/humaniti`:
```nginx
# Rate limiting zone: 20 requests/minute per IP
limit_req_zone $binary_remote_addr zone=humaniti_limit:10m rate=20r/m;

server {
    listen 80;
    server_name humaniti.internal;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name humaniti.internal;

    ssl_certificate /etc/ssl/certs/humaniti.crt;
    ssl_certificate_key /etc/ssl/private/humaniti.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum file upload size: matches MAX_UPLOAD_BYTES (2 GiB)
    client_max_body_size 2147M;
    client_body_timeout 300s;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';" always;

    location / {
        limit_req zone=humaniti_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

---

## 9. Operational Runbook & Health Checks

### 9.1: Health Endpoint Check
Verify database and application status:
```bash
curl -i http://localhost:3000/api/health
```
**Expected Response** (`200 OK` when healthy):
```json
{
  "status": "healthy",
  "database": "connected",
  "storage": "available",
  "provider": "blocked",
  "timestamp": "2026-10-23T23:30:00.000Z"
}
```

### 9.2: Database Health & Queue Inspection
Check the backlog of assessment jobs:
```bash
docker compose exec db psql -U humaniti -d humaniti_ai -c \
  "SELECT id, status, stage, progress, \"retryCount\", \"createdAt\" FROM \"AssessmentJob\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

### 9.3: Periodic Retention Cleanup
The assessment worker runs background cleanup automatically every 60 seconds. You can also trigger an immediate cleanup manually:
```bash
node .worker-build/scripts/assessment-worker.js --cleanup
```
This prunes completed/failed job records older than `REPORT_RETENTION_DAYS` (default: 30 days) and deletes unreferenced media files and stale scratch directories.

---

## 10. Verification & Zero-Leakage Audit Checklist

Before declaring a self-hosted instance ready for production:

- [ ] **No Secret Leakage**: Verify `.env.local` is present in `.gitignore` and never committed.
- [ ] **Loopback Database**: Run `ss -tulpn | grep 5432` — confirm port is bound to `127.0.0.1`, not `0.0.0.0`.
- [ ] **Storage Permissions**: Run `ls -ld .private/media` — confirm permissions are `drwx------` (`0700`).
- [ ] **Access Token Configured**: Confirm `ASSESSMENT_ACCESS_TOKEN` is set with $\ge 32$ random characters.
- [ ] **Blocked Provider Active**: Verify `ASSESSMENT_PROVIDER="blocked"` unless local model offline setup is complete and authorized.
- [ ] **Test Pipeline Run**: Run `npm test` and `npm run worker:test` to confirm all 141 tests pass cleanly.

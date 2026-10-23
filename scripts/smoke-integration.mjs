// Uses synthetic local media and the real PostgreSQL/API/worker path; no mock adapter or semantic grade.
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const origin = process.env.APP_ORIGIN;
const token = process.env.ASSESSMENT_ACCESS_TOKEN;
if (!origin || !token || !process.argv[2]) throw new Error("Provide configured local origin/token and an explicitly synthetic video path.");
const media = await readFile(process.argv[2]);
const headers = { authorization: `Bearer ${token}` };
async function create() {
  const response = await fetch(`${origin}/api/assessments`, { method: "POST", headers: { ...headers, "content-type": "video/mp4", "x-recording-consent": "true" }, body: media });
  assert.equal(response.status, 202);
  return (await response.json()).id;
}
async function worker(flag) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(".worker-build/scripts/assessment-worker.js"), flag], {
      env: { ...process.env, ASSESSMENT_PROVIDER: "blocked", NODE_ENV: "production" }, stdio: "ignore" });
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error("worker_failed")));
  });
}
try {
  const id = await create();
  await Promise.all([worker("--once"), worker("--once")]);
  const job = await db.assessmentJob.findUniqueOrThrow({ where: { id }, include: { events: true } });
  assert.equal(job.status, "FAILED"); assert.equal(job.errorCode, "provider_blocked");
  assert.equal(job.events.filter((e) => e.eventType === "job.started").length, 1);
  assert.equal(job.events.filter((e) => e.eventType === "job.failed").length, 1);
  await assert.rejects(access(join(resolve(process.env.PRIVATE_MEDIA_ROOT ?? ".private/media"), job.sourceRef.slice(10))));
  const status = await fetch(`${origin}/api/assessments/${id}`, { headers });
  assert.equal((await status.json()).status, "failed");
  const cancelId = await create();
  const cancel = await fetch(`${origin}/api/assessments/${cancelId}`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
  assert.equal(cancel.status, 200);
  const cancelled = await db.assessmentJob.findUniqueOrThrow({ where: { id: cancelId } });
  assert.equal(cancelled.errorCode, "cancelled");
  await assert.rejects(access(join(resolve(process.env.PRIVATE_MEDIA_ROOT ?? ".private/media"), cancelled.sourceRef.slice(10))));
  const expireId = await create();
  await db.assessmentJob.update({ where: { id: expireId }, data: { createdAt: new Date(Date.now() - 7_200_000) } });
  await worker("--cleanup");
  assert.equal((await db.assessmentJob.findUniqueOrThrow({ where: { id: expireId } })).errorCode, "processing_expired");
  console.log(JSON.stringify({ synthetic: true, durableConcurrentClaim: "PASS", persistedFailure: "PASS", cancellationCleanup: "PASS", expiry: "PASS", mock: false }));
} finally { await db.$disconnect(); }

import { expect, test, type Page, type Route } from "@playwright/test";
import { demoReport } from "../../lib/demo";

// Synthetic identities and API data only. Every /api request is intercepted, including unexpected ones.
const keyA = "synthetic-browser-personal-key-aaaaaaaa";
const keyB = "synthetic-browser-personal-key-bbbbbbbb";
const timestamp = "2026-10-23T00:00:00.000Z";
const item = (id: string, status = "completed") => ({ id, status, stage: status === "processing" ? "analysis" : status, createdAt: timestamp, qualityLabel: status === "completed" ? "Good" : null });
const job = (id: string, status = "completed", hasReport = true) => ({ id, status, stage: status === "processing" ? "analysis" : status, createdAt: timestamp, updatedAt: timestamp, progress: 65, hasReport, error: null });
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });
async function intercept(page: Page, handler: (route: Route, path: string) => Promise<void>) {
  await page.route("**/api/**", (route) => handler(route, new URL(route.request().url()).pathname));
}
async function unlock(page: Page, key = keyA) {
  await page.getByLabel("Personal access key").fill(key);
  await page.getByRole("button", { name: "Unlock workspace" }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("waits for explicit unlock, clears every private field on key change, and ignores a late report", async ({ page }) => {
  const calls: string[] = [];
  let release!: () => void;
  let reportStarted!: () => void;
  const started = new Promise<void>((resolve) => { reportStarted = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  // Exercise the response guards independently of the browser's AbortController implementation.
  await page.addInitScript(() => {
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input, init) => fetchOriginal(input, String(input).startsWith("/api/") ? { ...init, signal: undefined } : init);
  });
  await intercept(page, async (route, path) => {
    const ownerA = route.request().headers().authorization === `Bearer ${keyA}`;
    calls.push(path);
    if (path === "/api/assessments") return reply(route, { assessments: [item(ownerA ? "synthetic_owner_a" : "synthetic_owner_b", ownerA ? "completed" : "queued")], nextCursor: null });
    if (path.endsWith("/report")) { reportStarted(); await held; return reply(route, demoReport); }
    return reply(route, job("synthetic_owner_a"));
  });
  await page.goto("/?assessment=synthetic_owner_a");
  await page.getByLabel("Personal access key").fill(keyA);
  expect(calls).toEqual([]);
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await started;
  await page.getByLabel("Choose your class recording").setInputFiles({ name: "synthetic.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic test only") });
  await page.getByRole("checkbox").check();
  await page.getByLabel("Personal access key").fill(keyB);
  await expect(page.getByRole("heading", { name: "Your assessments" })).toHaveCount(0);
  await expect(page.getByText("synthetic.mp4", { exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/assessment=/);
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await expect(page.getByRole("button", { name: /synthetic_owner_b/ })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Good", exact: true })).toHaveCount(0);
  await expect(page.getByText(demoReport.observations[0].evidence, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(await page.getByLabel("Choose your class recording").inputValue()).toBe("");
  await page.getByRole("button", { name: "Lock & clear" }).click();
  await expect(page.getByRole("button", { name: /synthetic_owner_b/ })).toHaveCount(0);
  expect(await page.getByLabel("Personal access key").inputValue()).toBe("");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test("paginates private history and requires confirmation before terminal deletion", async ({ page }) => {
  let deletes = 0; let rejectDelete = true;
  await intercept(page, async (route, path) => {
    if (route.request().method() === "DELETE") {
      deletes++;
      return rejectDelete ? reply(route, { error: { code: "invalid_state", message: "Active assessments cannot be deleted." } }, 409) : reply(route, { ok: true });
    }
    if (path === "/api/assessments") {
      const second = new URL(route.request().url()).searchParams.get("cursor") === "synthetic page/2";
      return reply(route, { assessments: second ? [item("synthetic_terminal")] : [item("synthetic_active", "processing")], nextCursor: second ? null : "synthetic page/2" });
    }
    return reply(route, { error: { code: "unexpected", message: "Unexpected synthetic request." } }, 404);
  });
  await page.goto("/"); await unlock(page);
  await expect(page.getByRole("button", { name: "Delete assessment synthetic_active", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Load more assessments" }).click();
  await expect(page.getByRole("button", { name: /synthetic_active/ })).toBeVisible();
  const deletion = page.getByRole("button", { name: "Delete assessment synthetic_terminal", exact: true });
  await deletion.click();
  await expect(page.getByRole("button", { name: "Keep assessment" })).toBeFocused();
  await page.getByRole("button", { name: "Keep assessment" }).click(); expect(deletes).toBe(0);
  await deletion.click(); await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Active assessments cannot be deleted." })).toBeVisible();
  await expect(deletion).toBeVisible();
  rejectDelete = false;
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(deletion).toHaveCount(0); expect(deletes).toBe(2);
  await expect(page.getByRole("heading", { name: "Your assessments" })).toBeFocused();
  await noOverflow(page);
});

test("accepts a reused completed upload, shows its durable link, and relocks on reload", async ({ page }) => {
  let posts = 0; let postBody: Buffer | null = null;
  const body = Buffer.from("synthetic bytes; intercepted and never analyzed");
  await intercept(page, async (route, path) => {
    if (route.request().method() === "POST") {
      posts++; postBody = route.request().postDataBuffer();
      expect(route.request().headers()["x-recording-consent"]).toBe("true");
      expect(route.request().headers()["content-type"]).toBe("video/mp4");
      return reply(route, { id: "synthetic_reused", status: "completed", reused: true });
    }
    if (path === "/api/assessments") return reply(route, { assessments: [], nextCursor: null });
    if (path.endsWith("/report")) return reply(route, demoReport);
    return reply(route, job("synthetic_reused"));
  });
  await page.goto("/"); await unlock(page);
  await page.getByLabel("Choose your class recording").setInputFiles({ name: "synthetic.mp4", mimeType: "video/mp4", buffer: body });
  await expect(page.getByText("synthetic.mp4", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Assess recording" }).click();
  await expect(page.getByText("This recording already has an assessment.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good", exact: true })).toBeVisible();
  expect(posts).toBe(1); expect(postBody).toEqual(body);
  await expect(page).toHaveURL(/assessment=synthetic_reused/);
  await expect(page.getByRole("link", { name: "Open this assessment link" })).toHaveAttribute("href", "?assessment=synthetic_reused");
  await noOverflow(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Unlock workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good", exact: true })).toHaveCount(0);
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Good", exact: true })).toBeVisible();
});

test("validates files, explains disabled Drive, submits a permitted URL and cancels an active job", async ({ page }) => {
  let posts = 0; let cancelled = false;
  await intercept(page, async (route, path) => {
    if (route.request().method() === "POST") {
      posts++;
      expect(route.request().postDataJSON()).toEqual({ url: "https://media.example.test/synthetic.mp4" });
      expect(route.request().headers()["x-recording-consent"]).toBe("true");
      return reply(route, { id: "synthetic_url", status: "processing" }, 202);
    }
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toEqual({ action: "cancel" }); cancelled = true;
      return reply(route, { ok: true });
    }
    if (path === "/api/assessments") return reply(route, { assessments: [], nextCursor: null });
    return reply(route, { ...job("synthetic_url", cancelled ? "failed" : "processing", false), stage: cancelled ? "cancelled" : "analysis" });
  });
  await page.goto("/"); await unlock(page);
  const file = page.getByLabel("Choose your class recording");
  await file.setInputFiles({ name: "synthetic.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(0) });
  await expect(page.getByText("This file is empty.", { exact: false })).toBeVisible();
  await file.setInputFiles({ name: "synthetic.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048) });
  await expect(page.getByText("This file exceeds", { exact: false })).toBeVisible();
  await file.setInputFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic") });
  await expect(page.getByText("Choose an MP4, MOV or WebM video file.", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Google Drive", exact: true }).check();
  await expect(page.getByLabel("Permitted Google Drive file link")).toBeDisabled();
  await expect(page.getByText("Google Drive import is disabled", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assess recording" })).toBeDisabled();
  await page.getByRole("radio", { name: "Recording URL", exact: true }).check();
  await page.getByLabel("Permitted recording URL").fill("http://media.example.test/synthetic.mp4");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Assess recording" }).click();
  await expect(page.getByText("Use an HTTPS link", { exact: false })).toBeVisible(); expect(posts).toBe(0);
  await page.getByLabel("Permitted recording URL").fill("https://media.example.test/synthetic.mp4");
  await page.getByRole("button", { name: "Assess recording" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reviewing evidence" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("65%")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel assessment" }).click();
  await expect(page.getByRole("heading", { name: "Assessment cancelled" })).toBeVisible();
  expect(posts).toBe(1); await noOverflow(page);
});

test("401 locks the workspace and invalid status data never produces a report", async ({ page }) => {
  let unauthorized = false;
  await intercept(page, async (route, path) => {
    if (unauthorized) return reply(route, { error: { code: "unauthorized", message: "Invalid synthetic key." } }, 401);
    if (path === "/api/assessments") return reply(route, { assessments: [item("synthetic_invalid")], nextCursor: null });
    return reply(route, { ...job("synthetic_invalid"), status: "invented" });
  });
  await page.goto("/?assessment=synthetic_invalid"); await unlock(page);
  await expect(page.getByRole("alert").filter({ hasText: "invalid response" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good", exact: true })).toHaveCount(0);
  unauthorized = true;
  await page.getByRole("button", { name: "Refresh history" }).click();
  await expect(page.getByText("Access key was not accepted.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your assessments" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/assessment=/);
});

test("standalone demo is explicitly synthetic, keyboard navigable and makes no API calls", async ({ page }) => {
  let requests = 0;
  await intercept(page, async (route) => { requests++; await route.abort(); });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Synthetic demo · no live analysis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Illustrative evidence" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to the example report" })).toBeFocused();
  await page.getByRole("link", { name: /View evidence evidence_demo_clarity/ }).click();
  await expect(page).toHaveURL(/#evidence_demo_clarity$/);
  await noOverflow(page); expect(requests).toBe(0);
});

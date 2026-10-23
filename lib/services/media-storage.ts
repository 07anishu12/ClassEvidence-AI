import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";

/** POSIX permissions for private media and scratch storage */
export const STORAGE_PERMISSIONS = {
  DIR_MODE: 0o700, // rwx------
  FILE_MODE: 0o600, // rw-------
} as const;

/** Regex pattern for validated private upload filenames */
export const UPLOAD_FILENAME_PATTERN = /^[a-f0-9-]{36}\.(mp4|mov|webm)$/;

/** Regex pattern for worker scratch directories */
export const SCRATCH_DIR_PATTERN = /^work-([a-f0-9-]{36})$/;

/**
 * Validates that candidate path is strictly contained within parent directory.
 * Prevents directory traversal attacks via `..` or symbolic tricks.
 */
export function isPathContained(parent: string, candidate: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedCandidate = resolve(candidate);
  return (
    resolvedCandidate === resolvedParent ||
    resolvedCandidate.startsWith(resolvedParent + sep)
  );
}

/**
 * In-repository media must remain in the ignored private tree, outside web/build assets.
 * Throws if configured path points within workspace but outside `.private/`.
 */
export function privateMediaRoot(configured: string): string {
  const root = resolve(configured);
  const workspace = resolve(".");
  const privateTree = resolve(".private");
  if (
    (root === workspace || root.startsWith(workspace + sep)) &&
    root !== privateTree &&
    !root.startsWith(privateTree + sep)
  ) {
    throw new Error("private_storage_invalid");
  }
  return root;
}

/**
 * Resolves the scratch root directory, ensuring containment within `.private`.
 */
export function scratchRoot(configuredRoot: string): string {
  const mediaRoot = privateMediaRoot(configuredRoot);
  const scratch = join(mediaRoot, "scratch");
  return scratch;
}

/**
 * Resolves an active lease scratch directory for a worker claim.
 */
export function resolveScratchJobPath(mediaRoot: string, leaseToken: string): string {
  if (!/^[a-f0-9-]{36}$/.test(leaseToken)) {
    throw new Error("invalid_lease_token");
  }
  const root = privateMediaRoot(mediaRoot);
  return join(root, `work-${leaseToken}`);
}

/**
 * Ensures a private directory exists with strict 0o700 permissions and no symlink tricks.
 */
export async function ensurePrivateDirectory(dirPath: string): Promise<string> {
  const resolved = resolve(dirPath);
  await mkdir(resolved, { recursive: true, mode: STORAGE_PERMISSIONS.DIR_MODE });
  const real = await realpath(resolved);
  if (real !== resolved) {
    throw new Error("storage_unavailable_symlink");
  }
  const stats = await lstat(resolved);
  if (!stats.isDirectory()) {
    throw new Error("storage_not_directory");
  }
  return resolved;
}

/**
 * Validates and converts a `private://<uuid>.<ext>` URI to a verified filesystem path.
 */
export function resolvePrivateUploadPath(root: string, sourceRef: string): string {
  if (!sourceRef.startsWith("private://")) {
    throw new Error("invalid_private_uri");
  }
  const filename = sourceRef.slice("private://".length);
  if (!UPLOAD_FILENAME_PATTERN.test(filename)) {
    throw new Error("invalid_upload_filename");
  }
  const safeRoot = privateMediaRoot(root);
  const target = join(safeRoot, filename);
  if (!isPathContained(safeRoot, target)) {
    throw new Error("path_traversal_detected");
  }
  return target;
}

export interface StreamIntakeOptions {
  maxBytes: number;
  timeoutMs?: number;
  expectedSha256?: string;
  expectedMd5?: string;
  abortSignal?: AbortSignal;
}

export interface StreamIntakeResult {
  size: number;
  sha256: string;
  md5: string;
  head: Buffer;
}

/**
 * Streams an incoming media stream into private storage at `targetPath`.
 * Calculates SHA-256 and MD5 on the fly, enforces size limits, and securely
 * cleans up partial files on any error or timeout.
 */
export async function streamToPrivateStorage(
  stream: ReadableStream<Uint8Array>,
  targetPath: string,
  options: StreamIntakeOptions
): Promise<StreamIntakeResult> {
  const safeTarget = resolve(targetPath);
  const file = await open(safeTarget, "wx", STORAGE_PERMISSIONS.FILE_MODE);
  const reader = stream.getReader();

  let size = 0;
  let head = Buffer.alloc(0);
  const sha256 = createHash("sha256");
  const md5 = createHash("md5");
  let timedOut = false;
  let complete = false;

  const timeoutMs = options.timeoutMs ?? 120_000;
  const deadline = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        complete = true;
        break;
      }
      size += chunk.value.byteLength;
      sha256.update(chunk.value);
      md5.update(chunk.value);

      if (size > options.maxBytes) {
        throw new Error("upload_too_large");
      }

      if (head.length < 16) {
        head = Buffer.concat([head, Buffer.from(chunk.value)]).subarray(0, 16);
      }

      await file.writeFile(chunk.value);
    }

    if (!size || timedOut || options.abortSignal?.aborted) {
      throw new Error("stream_aborted_or_empty");
    }

    const digestSha256 = sha256.digest("hex");
    const digestMd5 = md5.digest("hex");

    if (options.expectedSha256 && options.expectedSha256 !== digestSha256) {
      throw new Error("source_integrity_sha256_mismatch");
    }
    if (options.expectedMd5 && options.expectedMd5 !== digestMd5) {
      throw new Error("source_integrity_md5_mismatch");
    }

    return {
      size,
      sha256: digestSha256,
      md5: digestMd5,
      head,
    };
  } catch (error) {
    await rm(safeTarget, { force: true }).catch(() => {});
    throw error;
  } finally {
    clearTimeout(deadline);
    if (!complete) {
      await reader.cancel().catch(() => {});
    }
    reader.releaseLock();
    await file.close().catch(() => {});
  }
}

/**
 * Cleans up a temporary scratch directory upon job completion or terminal failure.
 */
export async function cleanupScratchDirectory(scratchPath: string): Promise<boolean> {
  try {
    const resolved = resolve(scratchPath);
    const dirName = basename(resolved);
    // Safety guard: only remove directories matching work-UUID pattern
    if (!SCRATCH_DIR_PATTERN.test(dirName)) {
      return false;
    }
    await rm(resolved, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely removes a private source media file if it is a regular file with nlink === 1.
 */
export async function cleanupPrivateMedia(filePath: string): Promise<boolean> {
  try {
    const resolved = resolve(filePath);
    const stats = await lstat(resolved);
    if (stats.isFile() && stats.nlink === 1) {
      await rm(resolved, { force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

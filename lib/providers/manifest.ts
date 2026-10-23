import { createHash } from "node:crypto";
import { z } from "zod";

export const opaqueId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
const time = z.number().finite().min(0).max(86_400);
const base = { id: opaqueId, startSec: time, endSec: time, sha256: z.string().regex(/^[a-f0-9]{64}$/) };
export const artifactSchema = z.discriminatedUnion("modality", [
  z.object({ ...base, modality: z.literal("transcript"), text: z.string().min(1).max(10_000) }).strict(),
  z.object({ ...base, modality: z.literal("video"), mime: z.enum(["image/png", "image/jpeg"]),
    base64: z.string().min(4).max(2_800_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
]);

export const modelInputManifestSchema = z.object({
  version: z.literal("1"),
  jobId: opaqueId,
  durationSec: z.number().finite().positive().max(86_400),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  artifacts: z.array(artifactSchema).max(2000),
}).strict().superRefine((manifest, ctx) => {
  const ids = new Set<string>();
  for (const artifact of manifest.artifacts) {
    const bytes = artifact.modality === "transcript" ? Buffer.from(artifact.text) : Buffer.from(artifact.base64, "base64");
    if (ids.has(artifact.id) || artifact.endSec > manifest.durationSec || artifact.endSec < artifact.startSec ||
        (artifact.modality === "transcript" && artifact.startSec === artifact.endSec) ||
        (artifact.modality === "video" && artifact.startSec !== artifact.endSec) ||
        createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
      ctx.addIssue({ code: "custom", message: "Invalid artifact identity, timing, or digest" });
    }
    if (artifact.modality === "video") {
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (bytes.length > 2_000_000 || bytes.toString("base64") !== artifact.base64 ||
          !(artifact.mime === "image/png" ? png : jpeg)) {
        ctx.addIssue({ code: "custom", message: "Invalid frame content" });
      }
    }
    ids.add(artifact.id);
  }
});

export type ModelInputManifest = z.infer<typeof modelInputManifestSchema>;
export type ModelArtifact = z.infer<typeof artifactSchema>;

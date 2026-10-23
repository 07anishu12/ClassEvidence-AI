import { z } from "zod";
import { jobStatusSchema } from "./job";
export * from "./job";
export * from "./report";

import { isIP } from "node:net";

function isDisallowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".cluster.local") ||
    host === "0.0.0.0" ||
    host === "metadata.google.internal" ||
    host === "instance-data" ||
    host === "metadata" ||
    !host.includes(".")
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    const [first, second, third] = octets;
    return (
      first === 0 || // RFC 1122 'this' network
      first === 10 || // RFC 1918 private
      first === 127 || // RFC 1122 loopback
      (first === 100 && second >= 64 && second <= 127) || // RFC 6598 carrier-grade NAT
      (first === 169 && second === 254) || // RFC 3927 link-local (cloud metadata 169.254.169.254)
      (first === 172 && second >= 16 && second <= 31) || // RFC 1918 private
      (first === 192 && second === 0 && (third === 0 || third === 2)) || // RFC 5736 IETF & TEST-NET-1
      (first === 192 && second === 168) || // RFC 1918 private
      (first === 198 && (second === 18 || second === 19)) || // RFC 2544 benchmarking
      (first === 198 && second === 51 && third === 100) || // RFC 5737 TEST-NET-2
      (first === 203 && second === 0 && third === 113) || // RFC 5737 TEST-NET-3
      first >= 224 // RFC 5771 multicast & RFC 1112 reserved
    );
  }

  if (ipVersion === 6) {
    // IP-literal IPv6 sources, including mapped private IPv4, are not enabled.
    return true;
  }

  return false;
}

export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Source URL is malformed" });
      return;
    }

    if (url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "Source URLs must use HTTPS" });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain credentials" });
    }
    if (url.hash) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain fragments" });
    }
    if (url.port && url.port !== "443" && url.port !== "8443") {
      context.addIssue({ code: "custom", message: "Source URLs must use standard HTTPS ports" });
    }
    if (isDisallowedHost(url.hostname)) {
      context.addIssue({ code: "custom", message: "Source host must not be local or private" });
    }
  });

export const privateStorageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^private:\/\/[A-Za-z0-9][A-Za-z0-9/_-]*$/, "Invalid private storage reference")
  .refine((value) => !value.includes(".."), "Storage references cannot contain parent traversal");

export const sourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("url"),
      url: sourceUrlSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("upload"),
      storageKey: privateStorageKeySchema,
    })
    .strict(),
]);

export const assessmentCreateSchema = z
  .object({
    source: sourceSchema,
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_.:-]+$/, "idempotencyKey contains invalid characters")
      .optional(),
  })
  .strict();

export const assessmentCreatedSchema = z
  .object({
    id: z.string().trim().min(1),
    status: jobStatusSchema,
    reused: z.boolean().optional(),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z.string().min(1),
    code: z.string().min(1),
    message: z.string().optional(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AssessmentCreate = z.infer<typeof assessmentCreateSchema>;
export type AssessmentCreated = z.infer<typeof assessmentCreatedSchema>;

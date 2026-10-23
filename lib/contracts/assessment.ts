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
    host === "0.0.0.0"
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    const [first, second] = octets;
    return (
      first === 0 || first === 10 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 127 ||
      (first === 169 && second === 254)
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
    const url = new URL(value);

    if (url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "Source URLs must use HTTPS" });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain credentials" });
    }
    if (url.hash) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain fragments" });
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
  })
  .strict();

export const assessmentCreatedSchema = z
  .object({
    id: z.string().trim().min(1),
    status: jobStatusSchema,
  })
  .strict();

export type AssessmentCreate = z.infer<typeof assessmentCreateSchema>;

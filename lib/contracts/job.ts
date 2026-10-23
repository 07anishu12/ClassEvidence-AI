import { z } from "zod";

export const jobStatuses = ["queued", "processing", "completed", "failed"] as const;
export type JobStatus = (typeof jobStatuses)[number];
export const jobStatusSchema = z.enum(jobStatuses);

export const jobErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export const jobSchema = z
  .object({
    id: z.string().trim().min(1),
    status: jobStatusSchema,
    progress: z.number().int().min(0).max(100),
    stage: z.string().trim().min(1).max(100).nullable(),
    error: jobErrorSchema.nullable(),
    createdAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
    hasReport: z.boolean(),
  })
  .strict();

export type Job = z.infer<typeof jobSchema>;

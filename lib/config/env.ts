import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
        message: "DATABASE_URL must be a PostgreSQL connection URL",
      })
      .optional(),
    ASSESSMENT_PROVIDER: z.enum(["blocked"]).default("blocked"),
    APP_ORIGIN: z.string().url().default("http://localhost:3000"),
    PRIVATE_MEDIA_ROOT: z.string().min(1).default("./.private/media"),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(10_000_000_000).default(2_147_483_648),
  })
  .strict();

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse({
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: source.DATABASE_URL,
    ASSESSMENT_PROVIDER: source.ASSESSMENT_PROVIDER,
    APP_ORIGIN: source.APP_ORIGIN,
    PRIVATE_MEDIA_ROOT: source.PRIVATE_MEDIA_ROOT,
    MAX_UPLOAD_BYTES: source.MAX_UPLOAD_BYTES,
  });
}

export const env = parseEnv();

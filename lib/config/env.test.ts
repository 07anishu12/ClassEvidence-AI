import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

describe("environment validation", () => {
  it("accepts the blocked provider with a PostgreSQL URL", () => {
    expect(
      parseEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://humaniti@localhost:5432/humaniti_ai",
        ASSESSMENT_PROVIDER: "blocked",
      }),
    ).toMatchObject({
      NODE_ENV: "test",
      ASSESSMENT_PROVIDER: "blocked",
      MAX_UPLOAD_BYTES: 2_147_483_648,
    });
  });

  it("rejects non-PostgreSQL URLs and unconfigured provider modes", () => {
    expect(() => parseEnv({ NODE_ENV: "test", DATABASE_URL: "file:./dev.db" })).toThrow();
    expect(() => parseEnv({ NODE_ENV: "test", ASSESSMENT_PROVIDER: "mock" })).toThrow();
  });
});

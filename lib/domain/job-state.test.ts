import { describe, expect, it } from "vitest";

import { canTransition, transitionJobState } from "./job-state";

describe("assessment job state transitions", () => {
  it("allows only the deterministic forward flow", () => {
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("processing", "completed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
    expect(transitionJobState("queued", "processing")).toBe("processing");
  });

  it("rejects terminal, backward, and skipped transitions", () => {
    expect(canTransition("queued", "completed")).toBe(false);
    expect(canTransition("completed", "processing")).toBe(false);
    expect(() => transitionJobState("failed", "processing")).toThrow("Invalid job transition");
  });
});

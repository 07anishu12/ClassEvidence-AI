import { describe, expect, it } from "vitest";

import { ProviderBlockedError, blockedProvider, validateProviderOutput } from "./types";

describe("assessment provider boundary", () => {
  it("rejects production calls when no approved provider is configured", async () => {
    await expect(
      blockedProvider.analyze({
        jobId: "job_test",
        version: "1", durationSec: 10, artifacts: [],
      }),
    ).rejects.toBeInstanceOf(ProviderBlockedError);
  });

  it("validates evidence output without accepting an overall label", () => {
    const output = validateProviderOutput({
      providerVersion: "local-blocked", ratings: [],
      limitations: ["No approved semantic provider configured."],
      observations: [
        {
          id: "evidence_1", dimension: "technical_usability", uncertainty: "high",
          startSec: 2,
          endSec: 4,
          modality: "metadata",
          claim: "A media probe completed.",
          evidence: "The local media probe returned structured metadata.",
          impact: "neutral",
          provenance: { source: "metadata", locator: "media.format" },
        },
      ],
    });

    expect(output.observations).toHaveLength(1);
    expect(() => validateProviderOutput({ ...output, qualityLabel: "Excellent" })).toThrow();
  });
});

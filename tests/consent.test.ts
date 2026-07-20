import { describe, expect, it } from "vitest";
import {
  createConsentRecord,
  hasValidConsent,
} from "../lib/privacy/consent";

describe("privacy consent", () => {
  it("creates a versioned consent record", () => {
    const record = createConsentRecord(new Date("2026-07-16T10:00:00.000Z"));

    expect(record).toEqual({
      accepted: true,
      version: 2,
      acceptedAt: "2026-07-16T10:00:00.000Z",
    });
    expect(hasValidConsent(record)).toBe(true);
  });

  it("rejects missing or outdated consent", () => {
    expect(hasValidConsent(undefined)).toBe(false);
    expect(hasValidConsent({ accepted: false, version: 2 })).toBe(false);
    expect(
      hasValidConsent({ accepted: true, version: 1, acceptedAt: "old" }),
    ).toBe(false);
    expect(
      hasValidConsent({ accepted: true, version: 0, acceptedAt: "old" }),
    ).toBe(false);
  });
});

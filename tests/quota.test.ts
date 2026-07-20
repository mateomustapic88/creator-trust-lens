import { describe, expect, it } from "vitest";
import {
  getQuotaPeriod,
  getRemainingFreeQuickScans,
  normalizeFreeQuota,
  recordCompletedFreeQuickScan,
} from "../lib/billing/quota";

const july = new Date("2026-07-20T09:00:00.000Z");

describe("free Quick scan quota", () => {
  it("creates a monthly UTC quota with three scans available", () => {
    const quota = normalizeFreeQuota(undefined, july);

    expect(quota).toEqual({ period: "2026-07", completedQuickScans: 0 });
    expect(getRemainingFreeQuickScans(quota)).toBe(3);
  });

  it("counts completed scans and never returns a negative remainder", () => {
    let quota = normalizeFreeQuota(undefined, july);
    quota = recordCompletedFreeQuickScan(quota);
    quota = recordCompletedFreeQuickScan(quota);
    quota = recordCompletedFreeQuickScan(quota);
    quota = recordCompletedFreeQuickScan(quota);

    expect(quota.completedQuickScans).toBe(4);
    expect(getRemainingFreeQuickScans(quota)).toBe(0);
  });

  it("resets an older period and normalizes invalid counters", () => {
    expect(
      normalizeFreeQuota({ period: "2026-06", completedQuickScans: 3 }, july),
    ).toEqual({ period: "2026-07", completedQuickScans: 0 });
    expect(
      normalizeFreeQuota({ period: "2026-07", completedQuickScans: -2 }, july),
    ).toEqual({ period: "2026-07", completedQuickScans: 0 });
    expect(getQuotaPeriod(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01");
  });
});

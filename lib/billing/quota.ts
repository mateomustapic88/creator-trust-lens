import {
  FREE_QUICK_SCANS_PER_MONTH,
  FREE_QUOTA_STORAGE_KEY,
} from "./config";

export interface FreeQuotaRecord {
  period: string;
  completedQuickScans: number;
}

export { FREE_QUOTA_STORAGE_KEY };

export function getQuotaPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function normalizeFreeQuota(
  value: unknown,
  now = new Date(),
): FreeQuotaRecord {
  const period = getQuotaPeriod(now);
  if (!value || typeof value !== "object") {
    return { period, completedQuickScans: 0 };
  }

  const record = value as Partial<FreeQuotaRecord>;
  if (record.period !== period) {
    return { period, completedQuickScans: 0 };
  }

  const completedQuickScans = Number.isFinite(record.completedQuickScans)
    ? Math.max(0, Math.floor(record.completedQuickScans ?? 0))
    : 0;
  return { period, completedQuickScans };
}

export function getRemainingFreeQuickScans(record: FreeQuotaRecord): number {
  return Math.max(
    0,
    FREE_QUICK_SCANS_PER_MONTH - record.completedQuickScans,
  );
}

export function recordCompletedFreeQuickScan(
  record: FreeQuotaRecord,
): FreeQuotaRecord {
  return {
    ...record,
    completedQuickScans: record.completedQuickScans + 1,
  };
}

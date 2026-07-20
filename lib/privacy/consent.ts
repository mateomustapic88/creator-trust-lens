export const CONSENT_STORAGE_KEY = "creatorTrustLens:consent:v2";

export const PRIVACY_POLICY_URL =
  "https://sites.google.com/view/creator-trust-lens-privacy";

export interface ConsentRecord {
  accepted: true;
  version: 2;
  acceptedAt: string;
}

export function createConsentRecord(now = new Date()): ConsentRecord {
  return {
    accepted: true,
    version: 2,
    acceptedAt: now.toISOString(),
  };
}

export function hasValidConsent(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ConsentRecord>;
  return (
    record.accepted === true &&
    record.version === 2 &&
    typeof record.acceptedAt === "string"
  );
}

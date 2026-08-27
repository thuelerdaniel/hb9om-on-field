// Internal shared secret for server-to-server auth (automations → backend functions).
// Prevents unauthorized external callers from bypassing admin auth via the `scheduled` body flag.
// This secret lives in server-side code (not exposed to end users) and in admin-only automation configs.
const INTERNAL_SYNC_SECRET = "Hb9Om-0nF1eLd-1nt3rn4l-5ync-5ecr3t-2026-v1a9z7k3m2";

export function isInternalCall(body: any): boolean {
  return body?.internal_secret === INTERNAL_SYNC_SECRET;
}

export function getInternalSecret(): string {
  return INTERNAL_SYNC_SECRET;
}
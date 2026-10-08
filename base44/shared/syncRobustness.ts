// Shared sync robustness utilities — used by runDailySyncBatch and dailyRefreshChecker.
// v0.959: Centralized retry logic, delete protection, threshold alarms, error counters.

// ─── Source thresholds (expected minimum entries) ───
// If a source returns fewer entries than its threshold, it triggers a warning
// instead of a silent "success". 0 entries = always warning (unless source is
// known to legitimately return 0, like LLOTA spots).
export const SOURCE_THRESHOLDS: Record<string, number> = {
  sota: 100000,
  pota: 50000,
  hbff: 30000,
  castle: 40,
  castle_overpass: 400,
  lighthouse_illw: 500,
  iota: 1000,
  tota: 10000,
  llota_refs: 5000,
  repeater_eu_priority1: 1000,
  repeater_eu_priority2: 500,
  repeater_uk: 500,
  repeater_na_us: 5000,
  repeater_world_sa: 500,
  repeater_world_oceania: 10, // Low threshold — if 0, source is dead
  fm_funknetz: 50,
  ch_repeater_links: 50,
  repeater_coverage: 1, // At least 1 repeater calculated
};

// Sources that can legitimately return 0 entries (no warning for 0)
export const ZERO_OK_SOURCES = new Set([
  'llota_spots', // LLOTA spots can be 0 (no active activations)
  'ch_repeater_links', // Links may already exist (matchedCount > 0 but linksCreated = 0)
]);

// ─── Error counter logic ───
// 1st consecutive error → silent auto-retry (Nachlauf)
// 2nd consecutive error → notification (marked in report, no WhatsApp yet)
// 3rd consecutive error → auto-pause source (Daniel decides to re-enable)
export type ErrorAction = 'retry' | 'notify' | 'pause' | 'none';

export function getErrorAction(consecutiveFailures: number): ErrorAction {
  if (consecutiveFailures >= 3) return 'pause';
  if (consecutiveFailures === 2) return 'notify';
  if (consecutiveFailures === 1) return 'retry';
  return 'none';
}

// ─── Delete protection ───
// Returns true if existing data should be preserved (source failed or returned 0).
// The source functions check this flag and skip their delete phase when true.
export function shouldPreserveData(status: string, count: number, source: string): boolean {
  if (status === 'failed' || status === 'timeout') return true;
  if (count === 0 && !ZERO_OK_SOURCES.has(source)) return true;
  return false;
}

// ─── Nachlauf scheduling ───
// After a source fails all retries, schedule a Nachlauf (retry) for later in the day.
// The Nachlauf is stored in AppSetting and picked up by the next checker run.
export async function scheduleNachlauf(base44: any, source: string, retryDelayMinutes: number = 120): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `nachlauf_${source}_${today}`;
  const retryTime = new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString();

  try {
    const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
    if (existing && existing.length > 0) {
      // Already scheduled — don't schedule again
      return;
    }
    await base44.asServiceRole.entities.AppSetting.create({
      key,
      value: JSON.stringify({ source, scheduled_time: retryTime, attempts: 0 }),
    });
  } catch {}
}

// Check for due Nachläufe — returns source names that need a retry
export async function getDueNachlaufe(base44: any): Promise<string[]> {
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  const due: string[] = [];

  try {
    const settings = await base44.asServiceRole.entities.AppSetting.filter({
      key: { $regex: `^nachlauf_.*_${today}$` },
    });

    for (const s of settings || []) {
      try {
        const data = JSON.parse(s.value || '{}');
        if (data.scheduled_time && new Date(data.scheduled_time).getTime() <= now) {
          if (data.attempts < 1) { // Max 1 Nachlauf per source per day
            due.push(data.source);
          }
        }
      } catch {}
    }
  } catch {}

  return due;
}

// Mark Nachlauf as completed (delete the AppSetting)
export async function clearNachlauf(base44: any, source: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `nachlauf_${source}_${today}`;
  try {
    const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
    for (const s of existing || []) {
      await base44.asServiceRole.entities.AppSetting.delete(s.id);
    }
  } catch {}
}

// ─── Threshold check ───
// Returns null if OK, or a warning message if below threshold
export function checkThreshold(source: string, count: number): string | null {
  const threshold = SOURCE_THRESHOLDS[source];
  if (threshold == null) return null; // No threshold defined
  if (count === 0 && !ZERO_OK_SOURCES.has(source)) {
    return `0 Einträge — Quelle möglicherweise defekt (Erwartung: ≥${threshold})`;
  }
  if (count < threshold * 0.5) {
    return `Nur ${count} Einträge — deutlich unter Erwartung (≥${threshold})`;
  }
  return null;
}
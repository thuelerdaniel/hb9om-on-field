// Shared helpers for sync scheduler functions (runDailySyncBatch, dailyRefreshChecker).
// Extracted to avoid duplication between scheduler implementations.

export function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

export function isToday(isoStr: string): boolean {
  if (!isoStr) return false;
  return isoStr.startsWith(todayUTC());
}

// Extract count from various field names returned by different fetcher functions.
// Each fetcher uses different field names: count, total_count, total_saved, etc.
export function extractCount(data: any): number {
  if (!data) return 0;
  const v = data.count ?? data.total_count ?? data.total_saved ??
    data.imported ?? data.matchedRepeaters ?? data.nodesSaved ?? data.bmDevicesSaved;
  if (v != null) return v;
  // CH-Relais-Links: report matchedCount (links already exist = success)
  if (data.matchedCount != null && data.matchedCount > 0) return data.matchedCount;
  // TOTA returns separate antenna/tower/worldwide counts
  if (data.antennas_imported != null || data.towers_imported != null || data.worldwide_imported != null) {
    return (data.antennas_imported || 0) + (data.towers_imported || 0) + (data.worldwide_imported || 0);
  }
  return 0;
}

// Check if a source result should be treated as "source reachable" even with 0 new records.
// Used for CH-Relais-Links where matchedCount > 0 means the source IS reachable,
// even if linksCreated === 0 (links already exist).
export function isSourceReachable(data: any): boolean {
  if (!data) return false;
  if (data.matchedCount != null && data.matchedCount > 0) return true;
  if (data.uskaCount != null && data.uskaCount > 0) return true;
  return false;
}

// Extract status from various response formats
export function extractStatus(data: any): 'success' | 'failed' {
  if (!data) return 'failed';
  if (data.status === 'failed' || data.error) return 'failed';
  if (data.success === false) return 'failed';
  return 'success';
}

// Fisher-Yates shuffle — returns a new shuffled array, doesn't mutate input.
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
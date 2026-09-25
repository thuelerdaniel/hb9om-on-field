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
// v0.955: Erweitert um saved, fetched, merged, new_castles, linksCreated, countriesSaved usw.
// — vorher stand last_count auf 0 trotz erfolgreicher Läufe weil Feldnamen nicht erkannt wurden.
export function extractCount(data: any): number {
  if (!data) return 0;
  // Direct count fields (most common)
  const v = data.count ?? data.total_count ?? data.total_saved ??
    data.imported ?? data.saved ?? data.fetched ?? data.merged ??
    data.matchedRepeaters ?? data.nodesSaved ?? data.bmDevicesSaved ??
    data.new_castles ?? data.total_overpass ?? data.linksCreated ??
    data.countriesSaved ?? data.calculated;
  if (v != null) return v;
  // CH-Relais-Links: report matchedCount (links already exist = success)
  if (data.matchedCount != null && data.matchedCount > 0) return data.matchedCount;
  // TOTA returns separate antenna/tower/worldwide counts
  if (data.antennas_imported != null || data.towers_imported != null || data.worldwide_imported != null) {
    return (data.antennas_imported || 0) + (data.towers_imported || 0) + (data.worldwide_imported || 0);
  }
  // LLOTA spots: fetched = llota_direct + spothole, saved = merged count
  if (data.llota_direct != null || data.spothole_enriched != null) {
    return data.saved || data.fetched || 0;
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

// Retry with exponential backoff for HTTP fetches.
// 3 attempts total: initial + 2 retries with 10s / 30s / 60s backoff.
// Retries on: 5xx, 429 (rate limited), timeout (AbortController), network error.
// Does NOT retry on: 4xx (except 429), successful responses.
//
// Returns { ok, status, text, json, error }.
// `text` and `json` are populated from the response body on success.
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
  backoffMs: number[] = [10000, 30000, 60000]
): Promise<{ ok: boolean; status: number; text: string; json: any; error?: string }> {
  const maxAttempts = backoffMs.length + 1; // initial + retries
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      // 429 or 5xx → retry (if attempts remain)
      if (resp.status === 429 || resp.status >= 500) {
        const bodyText = await resp.text().catch(() => '');
        if (attempt < backoffMs.length) {
          console.log(`[fetchWithRetry] ${url.substring(0, 80)} attempt ${attempt + 1}/${maxAttempts} HTTP ${resp.status}, retry in ${backoffMs[attempt] / 1000}s`);
          await new Promise(r => setTimeout(r, backoffMs[attempt]));
          continue;
        }
        return { ok: false, status: resp.status, text: bodyText, json: null, error: `HTTP ${resp.status}: ${bodyText.substring(0, 300)}` };
      }

      // Success or non-retryable 4xx
      const text = await resp.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      return { ok: resp.ok, status: resp.status, text, json, error: resp.ok ? undefined : `HTTP ${resp.status}` };
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError';
      if (attempt < backoffMs.length) {
        console.log(`[fetchWithRetry] ${url.substring(0, 80)} attempt ${attempt + 1}/${maxAttempts} ${isAbort ? 'timeout' : 'error'}: ${e?.message || e}, retry in ${backoffMs[attempt] / 1000}s`);
        await new Promise(r => setTimeout(r, backoffMs[attempt]));
        continue;
      }
      return { ok: false, status: 0, text: '', json: null, error: isAbort ? `Timeout nach ${timeoutMs / 1000}s` : (e?.message || 'Network error') };
    }
  }
  return { ok: false, status: 0, text: '', json: null, error: 'Max retries exceeded' };
}

// POST with retry — convenience wrapper for form-encoded POST requests.
export async function postWithRetry(
  url: string,
  body: string,
  headers: Record<string, string> = {},
  timeoutMs: number = 30000,
  backoffMs: number[] = [10000, 30000, 60000]
): Promise<{ ok: boolean; status: number; text: string; json: any; error?: string }> {
  return fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
  }, timeoutMs, backoffMs);
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
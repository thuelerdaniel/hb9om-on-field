// Shared sync-protection logic for json-imported repeaters.
// Used by fetchRepeaters and fetchHearhamRepeaters to skip records
// that were imported via the JSON Repeater Import feature.

export const JSON_IMPORT_SOURCE_ID = "json-import";

// Build a sync key from callsign + frequency (rounded to 0.001 MHz)
export function buildSyncKey(callsign: string, frequency: number): string {
  const freqRounded = Math.round((frequency || 0) * 1000) / 1000;
  const cs = String(callsign || "UNKNOWN").toUpperCase().trim();
  return `${cs}|${freqRounded}`;
}

// Load all json-import repeaters and build a Set of sync keys.
// Returns the Set for O(1) lookup during sync.
export async function loadProtectionSet(base44: any): Promise<Set<string>> {
  const set = new Set<string>();
  let skip = 0;
  for (let i = 0; i < 10; i++) {
    const batch = await base44.asServiceRole.entities.Repeater.filter(
      { source_id: JSON_IMPORT_SOURCE_ID }, "id", 5000, skip
    );
    if (!batch || batch.length === 0) break;
    for (const r of batch) {
      set.add(buildSyncKey(r.callsign, r.frequency));
    }
    skip += batch.length;
    if (batch.length < 5000) break;
  }
  return set;
}

// Check if a new record would collide with a protected record
export function isProtected(record: any, protectionSet: Set<string>): boolean {
  return protectionSet.has(buildSyncKey(record.callsign, record.frequency));
}

// Filter an array of records, removing protected ones and counting them
export function filterProtected(records: any[], protectionSet: Set<string>): {
  toCreate: any[];
  protectedCount: number;
} {
  let protectedCount = 0;
  const toCreate: any[] = [];
  for (const r of records) {
    if (isProtected(r, protectionSet)) {
      protectedCount++;
    } else {
      toCreate.push(r);
    }
  }
  return { toCreate, protectedCount };
}
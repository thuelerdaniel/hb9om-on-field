// Offset-based paginated loader for PrivateNode — loads ALL records in batches
// using skip/offset pagination. Avoids the 10k single-query cap and reduces peak
// memory usage by streaming batches. Calls onBatch(batch, totalLoaded) after each
// batch so the UI can display markers progressively as they arrive.
import { base44 } from "@/api/base44Client";

const BATCH_SIZE = 2000;
const MAX_RECORDS = 60000;

export async function loadAllPrivateNodes({ onBatch, maxRecords = MAX_RECORDS } = {}) {
  const all = [];
  let skip = 0;

  do {
    const batch = await base44.entities.PrivateNode.list("-created_date", BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (onBatch) onBatch(batch, all.length);
    if (all.length >= maxRecords) break;
    skip += BATCH_SIZE;
  } while (true);

  return all;
}

// Load ALL repeaters using skip/offset pagination.
// The Repeater entity can have 31000+ records — a single list() call is capped
// at 10000, which caused the country filter to miss countries whose repeaters
// were saved last (sorted by -created_date). This loader fetches ALL records
// in batches so the country list and counts are complete and consistent.
const REPEATER_BATCH_SIZE = 5000;
const REPEATER_MAX_RECORDS = 80000;

export async function loadAllRepeaters({ onBatch, maxRecords = REPEATER_MAX_RECORDS } = {}) {
  const all = [];
  let skip = 0;

  do {
    const batch = await base44.entities.Repeater.list("-created_date", REPEATER_BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (onBatch) onBatch(batch, all.length);
    if (all.length >= maxRecords) break;
    skip += REPEATER_BATCH_SIZE;
  } while (true);

  return all;
}
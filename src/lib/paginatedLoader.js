// Offset-based paginated loader for PrivateNode — loads ALL records in batches
// using deterministic _id-sorted skip/offset pagination. Avoids the 10k single-
// query cap and reduces peak memory usage by streaming batches. Calls
// onBatch(batch, totalLoaded) after each batch so the UI can display markers
// progressively as they arrive.
//
// id sort is used instead of -created_date because all nodes are inserted in a
// single bulk batch with identical timestamps — a non-deterministic tie-break
// can skip or duplicate records across pages. id is unique so pages are stable.
import { base44 } from "@/api/base44Client";

const BATCH_SIZE = 2000;
const MAX_RECORDS = 60000;

export async function loadAllPrivateNodes({ onBatch, maxRecords = MAX_RECORDS } = {}) {
  const all = [];
  const seenIds = new Set();
  let skip = 0;
  let stallCount = 0;

  do {
    const batch = await base44.entities.PrivateNode.list("id", BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;

    const newRecords = [];
    for (const r of batch) {
      if (r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        newRecords.push(r);
      }
    }

    if (newRecords.length > 0) {
      all.push(...newRecords);
      if (onBatch) onBatch(newRecords, all.length);
    }

    if (all.length >= maxRecords) break;
    if (batch.length < BATCH_SIZE) break;
    if (newRecords.length === 0) {
      stallCount++;
      if (stallCount > 3) break;
    } else {
      stallCount = 0;
    }
    skip += BATCH_SIZE;
  } while (true);

  return all;
}

// Load ALL repeaters using deterministic _id-sorted skip/offset pagination.
//
// Why id instead of -created_date:
//   All repeaters are inserted in a single bulkCreate batch, so every record
//   has an identical created_date timestamp. Sorting by -created_date is
//   non-deterministic when timestamps tie — the database may return records in
//   arbitrary order across pages, causing some records to be skipped and others
//   to appear twice. Sorting by id (ascending) is fully deterministic because
//   id is unique per record, so every page boundary is stable and no record
//   is lost or duplicated.
//
// The Repeater entity can have 31000+ records — a single list() call is capped
// at 10000. This loader fetches ALL records in batches so the country list and
// counts are complete and consistent.
const REPEATER_BATCH_SIZE = 5000;
const REPEATER_MAX_RECORDS = 80000;

export async function loadAllRepeaters({ onBatch, maxRecords = REPEATER_MAX_RECORDS } = {}) {
  const all = [];
  const seenIds = new Set();
  let skip = 0;
  let stallCount = 0;

  do {
    const batch = await base44.entities.Repeater.list("id", REPEATER_BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;

    // Deduplicate by id — safety net against any pagination instability
    // (e.g. a record inserted mid-load shifting the skip offset).
    const newRecords = [];
    for (const r of batch) {
      if (r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        newRecords.push(r);
      }
    }

    if (newRecords.length > 0) {
      all.push(...newRecords);
      if (onBatch) onBatch(newRecords, all.length);
    }

    if (all.length >= maxRecords) break;

    // If the page returned records but all were duplicates (page shrank due to
    // mid-load insertions), advance skip but guard against infinite loops.
    if (batch.length < REPEATER_BATCH_SIZE) break; // last page reached
    if (newRecords.length === 0) {
      stallCount++;
      if (stallCount > 3) break;
    } else {
      stallCount = 0;
    }
    skip += REPEATER_BATCH_SIZE;
  } while (true);

  return all;
}
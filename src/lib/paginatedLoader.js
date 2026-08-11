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
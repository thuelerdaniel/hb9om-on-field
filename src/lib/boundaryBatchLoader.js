// Batch boundary loader — orchestrates client cache + server batch + progressive refill.
// Used by "Alle anzeigen" mode in POTA/WWFF/LLOTA filters.
//
// Flow:
//   1. Check client cache (IndexedDB) → apply cached polygons instantly (0 network calls)
//   2. Call getPotaBoundaries batch (server cache only, no upstream) → apply + cache client-side
//   3. Progressive refill: for parks still without boundary, queue single getPotaBoundary
//      calls (rate-limited ~2/s, max 20 per map movement) → apply + cache as they arrive
//
// Fairness: never bulk-fetch from pota-map.fr. The server cache grows organically with usage.

import { base44 } from "@/api/base44Client";
import {
  getCachedBoundaries,
  setCachedBoundaries,
  setCachedBoundary,
} from "@/lib/boundaryClientCache";

// Layer type → program mapping for pota-map.fr API
const LAYER_TO_PROGRAM = {
  pota: "pota",
  hbff: "wwff",   // WWFF layer uses "hbff" as layerType
  llota: "llota",
};

const BATCH_SIZE = 200;        // max refs per getPotaBoundaries call
const REFILL_RATE_MS = 550;    // ~1.8 req/s — fair to pota-map.fr
const REFILL_MAX_PER_MOVE = 20; // max progressive refills per map movement

// Active refill queue — prevents duplicate queues for the same references
let refillQueue = [];
let refillRunning = false;
let refillAbort = null;

// Apply boundaries to boundaryPoints state (called by Home.jsx via callback)
// applyBoundaries(refToPolygonMap) — updates boundaryPoints in place
export function startBatchBoundaryLoad(layerType, references, applyBoundaries) {
  const program = LAYER_TO_PROGRAM[layerType];
  if (!program || references.length === 0) return;

  // Abort any previous refill queue
  if (refillAbort) refillAbort.aborted = true;
  refillAbort = { aborted: false };
  const myAbort = refillAbort;

  (async () => {
    // 1. Client cache check — instant, zero network
    let clientCached = {};
    try {
      clientCached = await getCachedBoundaries(program, references);
    } catch (e) { /* silent */ }

    const clientHits = {};
    const uncached = [];
    for (const ref of references) {
      if (clientCached[ref] && clientCached[ref].polygon && clientCached[ref].polygon.length > 2) {
        clientHits[ref] = clientCached[ref];
      } else {
        uncached.push(ref);
      }
    }

    // Apply client-cached polygons immediately
    if (Object.keys(clientHits).length > 0) {
      applyBoundaries(clientHits, true);
    }

    if (myAbort.aborted) return;

    // 2. Server batch fetch (PotaBoundaryCache only — no upstream)
    const serverHits = {};
    const stillMissing = [];
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const chunk = uncached.slice(i, i + BATCH_SIZE);
      try {
        const res = await base44.functions.invoke("getPotaBoundaries", {
          references: chunk,
          program,
        });
        if (res.data?.boundaries) {
          for (const [ref, b] of Object.entries(res.data.boundaries)) {
            if (b.polygon && b.polygon.length > 2) {
              serverHits[ref] = b;
            }
          }
        }
        // res.data.missing tells us which refs have no cached boundary at all
        if (Array.isArray(res.data?.missing)) {
          stillMissing.push(...res.data.missing);
        }
      } catch (e) { /* silent */ }
      if (myAbort.aborted) return;
    }

    // Apply server-cached polygons
    if (Object.keys(serverHits).length > 0) {
      applyBoundaries(serverHits, true);
      // Store in client cache
      try { await setCachedBoundaries(program, serverHits); } catch (e) { /* silent */ }
    }

    if (myAbort.aborted) return;

    // 3. Progressive refill — rate-limited single fetches for parks without any cache
    //    Max REFILL_MAX_PER_MOVE per map movement to avoid hammering pota-map.fr
    const toRefill = stillMissing.slice(0, REFILL_MAX_PER_MOVE);
    if (toRefill.length > 0) {
      for (const ref of toRefill) {
        if (myAbort.aborted) return;
        try {
          const res = await base44.functions.invoke("getPotaBoundary", {
            reference: ref,
            program,
          });
          if (res.data?.polygon && Array.isArray(res.data.polygon) && res.data.polygon.length > 2) {
            const b = { polygon: res.data.polygon, has_boundary: true, name: res.data.name || "" };
            applyBoundaries({ [ref]: b }, true);
            try { await setCachedBoundary(program, ref, b); } catch (e) { /* silent */ }
          } else {
            // Cache the "no boundary" result too — avoids re-fetching
            const b = { polygon: null, has_boundary: false, name: res.data?.name || "" };
            try { await setCachedBoundary(program, ref, b); } catch (e) { /* silent */ }
          }
        } catch (e) { /* silent */ }
        await new Promise(r => setTimeout(r, REFILL_RATE_MS));
      }
    }
  })();
}

// Get a single boundary with client cache check first.
// Returns { polygon, has_boundary, name } or null.
export async function fetchBoundaryWithCache(program, reference) {
  // 1. Client cache
  try {
    const cached = await getCachedBoundaries(program, [reference]);
    if (cached[reference]) {
      if (cached[reference].polygon && cached[reference].polygon.length > 2) {
        return cached[reference];
      }
      // has_boundary=false cached → return as "no boundary" (avoid network)
      if (cached[reference].has_boundary === false) {
        return cached[reference];
      }
    }
  } catch (e) { /* silent */ }

  // 2. Server fetch (getPotaBoundary — checks server cache + upstream if needed)
  try {
    const res = await base44.functions.invoke("getPotaBoundary", {
      reference,
      program,
    });
    if (res.data) {
      const b = {
        polygon: res.data.polygon || null,
        has_boundary: res.data.has_boundary || false,
        name: res.data.name || "",
      };
      // Store in client cache
      try { await setCachedBoundary(program, reference, b); } catch (e) { /* silent */ }
      return b;
    }
  } catch (e) { /* silent */ }

  return null;
}

// Abort any running progressive refill queue
export function abortBoundaryRefill() {
  if (refillAbort) refillAbort.aborted = true;
}
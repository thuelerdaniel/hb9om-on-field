// IndexedDB storage for offline map tiles and area metadata

const DB_NAME = "hb9om_offline_maps";
const DB_VERSION = 1;
const TILE_STORE = "tiles";
const AREA_STORE = "areas";

let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        db.createObjectStore(TILE_STORE);
      }
      if (!db.objectStoreNames.contains(AREA_STORE)) {
        db.createObjectStore(AREA_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// --- Tile storage ---

export async function saveTile(key, blob) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TILE_STORE, "readwrite");
    tx.objectStore(TILE_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTile(key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TILE_STORE, "readonly");
    const req = tx.objectStore(TILE_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllTiles() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TILE_STORE, "readwrite");
    tx.objectStore(TILE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Area metadata ---

export async function saveArea(area) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AREA_STORE, "readwrite");
    tx.objectStore(AREA_STORE).put(area);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineAreas() {
  return getAreas();
}

export async function getAreas() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AREA_STORE, "readonly");
    const req = tx.objectStore(AREA_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteArea(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AREA_STORE, "readwrite");
    tx.objectStore(AREA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Storage estimate ---

export async function getStorageEstimate() {
  const areas = await getAreas();
  const db = await getDB();
  const tileCount = await new Promise((resolve) => {
    const tx = db.transaction(TILE_STORE, "readonly");
    const req = tx.objectStore(TILE_STORE).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });
  return { areas: areas.length, tiles: tileCount };
}

// --- Tile coordinate calculations ---

function lngToTileX(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

export function calculateTiles(bounds, zoomLevels) {
  const tiles = [];
  for (const zoom of zoomLevels) {
    const xMin = Math.max(0, lngToTileX(bounds.west, zoom));
    const xMax = Math.min(Math.pow(2, zoom) - 1, lngToTileX(bounds.east, zoom));
    const yMin = Math.max(0, latToTileY(bounds.north, zoom));
    const yMax = Math.min(Math.pow(2, zoom) - 1, latToTileY(bounds.south, zoom));
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z: zoom, x, y });
      }
    }
  }
  return tiles;
}

// --- URL resolution ---

export function resolveTileUrl(template, z, x, y) {
  let url = template;
  if (url.includes("{s}")) {
    const subs = ["a", "b", "c"];
    url = url.replace("{s}", subs[(x + y) % 3]);
  }
  return url.replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

// --- Tile download ---

export async function downloadTiles(tiles, tileKeyPrefix, urlTemplate, onProgress) {
  const CONCURRENCY = 5;
  let downloaded = 0;
  let failed = 0;
  let totalBytes = 0;

  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    const batch = tiles.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (tile) => {
        const key = `${tileKeyPrefix}_${tile.z}_${tile.x}_${tile.y}`;

        // Skip if already cached
        const existing = await getTile(key);
        if (existing) {
          downloaded++;
          totalBytes += existing.size || 0;
          return;
        }

        const url = resolveTileUrl(urlTemplate, tile.z, tile.x, tile.y);
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          const blob = await resp.blob();
          await saveTile(key, blob);
          downloaded++;
          totalBytes += blob.size || 0;
        } catch (e) {
          failed++;
        }
      })
    );

    if (onProgress) {
      onProgress({ downloaded, failed, total: tiles.length, sizeBytes: totalBytes });
    }

    // Rate limit between batches
    await new Promise((r) => setTimeout(r, 150));
  }

  return { downloaded, failed, total: tiles.length, sizeBytes: totalBytes };
}

// --- Offline reference data ---

export async function loadOfflineReferences() {
  const areas = await getAreas();
  const refs = { sota: [], pota: [], hbff: [], wwbota: [], castle: [], iota: [], lighthouse: [] };
  for (const area of areas) {
    if (area.references) {
      for (const type of Object.keys(refs)) {
        if (area.references[type]) {
          refs[type] = refs[type].concat(area.references[type]);
        }
      }
    }
  }
  // Deduplicate by code
  for (const type of Object.keys(refs)) {
    const seen = new Set();
    refs[type] = refs[type].filter((r) => {
      const code = r.code || r.reference;
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  }
  return refs;
}
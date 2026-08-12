import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Background coverage calculator for repeaters.
// Starts with Switzerland (CH) by default, expands to more countries on demand.
// Refinement: band estimate → APRS-refined → terrain-adjusted (elevation + obstacles).
// Returns progress statistics for the admin dashboard.
//
// Per-location-once policy:
// - Skip repeaters already calculated (coverage_updated != null) unless force or needs_recalc
// - Admin can mark repeaters with needs_recalc=true for next-cycle recalculation
// - Elevation data from Open-Elevation API adjusts coverage based on terrain

const COVERAGE_RADIUS_KM: Record<string, number> = {
  "10m": 80,
  "6m": 60,
  "4m": 50,
  "2m": 35,
  "70cm": 25,
  "23cm": 15,
  "Other": 30,
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fetch elevation for a single point from Open-Elevation API
async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const resp = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.results?.[0]?.elevation ?? null;
  } catch {
    return null;
  }
}

// Fetch elevations for multiple points in one request (batch)
async function fetchElevationsBatch(points: Array<{lat: number, lng: number}>): Promise<(number | null)[]> {
  if (points.length === 0) return [];
  try {
    const locations = points.map(p => `${p.lat},${p.lng}`).join('|');
    const resp = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locations}`, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0' },
    });
    if (!resp.ok) return points.map(() => null);
    const data = await resp.json();
    return (data.results || []).map((r: any) => r.elevation ?? null);
  } catch {
    return points.map(() => null);
  }
}

// Calculate terrain factor based on repeater elevation vs surrounding terrain
// Returns factor 0.5-1.5: >1 = repeater on high ground (better coverage), <1 = in valley
function calculateTerrainFactor(repeaterElev: number, surroundingElevs: (number | null)[]): { factor: number; description: string } {
  const valid = surroundingElevs.filter((e): e is number => e !== null);
  if (valid.length < 3) return { factor: 1, description: 'unzureichende Höhendaten' };

  const avgSurrounding = valid.reduce((a, b) => a + b, 0) / valid.length;
  const heightDiff = repeaterElev - avgSurrounding;

  // Repeater is significantly higher than surroundings → better coverage
  if (heightDiff > 200) return { factor: 1.4, description: 'exponierte Höhenlage (+200m)' };
  if (heightDiff > 100) return { factor: 1.25, description: 'hoch gelegen (+100m)' };
  if (heightDiff > 50) return { factor: 1.1, description: 'leicht erhöht (+50m)' };
  // Repeater is in a valley → reduced coverage
  if (heightDiff < -200) return { factor: 0.6, description: 'in Talgebiet (-200m)' };
  if (heightDiff < -100) return { factor: 0.75, description: 'tief gelegen (-100m)' };
  if (heightDiff < -50) return { factor: 0.9, description: 'leicht abgesenkt (-50m)' };
  // Flat terrain
  return { factor: 1.0, description: 'flaches Gelände' };
}

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const force = req.body?.force === true;
    const countryCode = req.body?.country_code || "CH";
    const expand = req.body?.expand === true;
    const useTerrain = req.body?.use_terrain !== false; // default true
    const repeaterIds = req.body?.repeater_ids; // specific IDs to recalc

    // Auth: allow service-role (no user = automation) or admin user
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Fetch all repeaters
    const allRepeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 10000);

    // Determine which repeaters to process
    let repeaters: any[];
    if (repeaterIds && Array.isArray(repeaterIds) && repeaterIds.length > 0) {
      // Recalculate specific repeaters by ID
      repeaters = allRepeaters.filter((r: any) => repeaterIds.includes(r.id));
    } else if (expand || countryCode === "all") {
      repeaters = allRepeaters;
    } else {
      repeaters = allRepeaters.filter((r: any) => r.country_code === countryCode);
    }

    // Also include repeaters marked for recalculation (needs_recalc=true)
    const needsRecalcRepeaters = allRepeaters.filter((r: any) => r.needs_recalc === true);
    const existingIds = new Set(repeaters.map((r: any) => r.id));
    for (const r of needsRecalcRepeaters) {
      if (!existingIds.has(r.id)) {
        repeaters.push(r);
        existingIds.add(r.id);
      }
    }

    // Also include NEW repeaters (no coverage_updated yet) from ANY country —
    // ensures newly scraped repeaters from DE/AT/FR/IT/GB/AU get coverage calculated
    // even when the automation runs with countryCode="CH" (the default).
    const newRepeaters = allRepeaters.filter((r: any) =>
      r.coverage_updated == null && r.lat != null && r.lng != null
    );
    for (const r of newRepeaters) {
      if (!existingIds.has(r.id)) {
        repeaters.push(r);
        existingIds.add(r.id);
      }
    }

    // Fetch APRS stations (PrivateNodes) for distance-based refinement
    const aprsStations = await base44.asServiceRole.entities.PrivateNode.list("-created_date", 10000);
    const stationsWithCoords = (aprsStations || []).filter((n: any) => n.lat != null && n.lng != null);

    const now = new Date().toISOString();
    const updates: any[] = [];
    let bandEstimated = 0;
    let aprsRefined = 0;
    let terrainAdjusted = 0;
    let skipped = 0;

    for (const r of repeaters) {
      if (r.lat == null || r.lng == null) { skipped++; continue; }

      // Skip already calculated unless force or needs_recalc
      if (!force && !r.needs_recalc && r.coverage_updated != null && r.coverage_source === "terrain_adjusted") {
        skipped++;
        continue;
      }
      if (!force && !r.needs_recalc && r.coverage_source === "aprs_refined") { skipped++; continue; }
      if (!force && !r.needs_recalc && r.coverage_source === "manual") { skipped++; continue; }

      const bandRadius = COVERAGE_RADIUS_KM[r.band] || COVERAGE_RADIUS_KM["Other"];

      // APRS refinement: count stations within 150 km and find max distance
      let maxAprsDistance = 0;
      let stationCount = 0;
      for (const station of stationsWithCoords) {
        const dist = haversineKm(r.lat, r.lng, station.lat, station.lng);
        if (dist <= 150) {
          stationCount++;
          if (dist > maxAprsDistance) maxAprsDistance = dist;
        }
      }

      let coverageRadius = bandRadius;
      let source = "band_estimate";
      let refinementPct = 20;
      let terrainFactor = r.terrain_factor || 1;
      let elevationM = r.elevation_m;

      // Terrain adjustment using elevation data (most accurate)
      if (useTerrain) {
        // Fetch repeater elevation if not cached
        if (elevationM == null) {
          elevationM = await fetchElevation(r.lat, r.lng);
        }

        if (elevationM != null) {
          // Sample 8 points around the repeater at band radius distance
          const samplePoints: Array<{lat: number, lng: number}> = [];
          for (let angle = 0; angle < 360; angle += 45) {
            const rad = angle * Math.PI / 180;
            const dLat = (bandRadius / 111.32) * Math.cos(rad);
            const dLng = (bandRadius / (111.32 * Math.cos(r.lat * Math.PI / 180))) * Math.sin(rad);
            samplePoints.push({ lat: r.lat + dLat, lng: r.lng + dLng });
          }
          const surroundingElevs = await fetchElevationsBatch(samplePoints);
          const terrain = calculateTerrainFactor(elevationM, surroundingElevs);
          terrainFactor = terrain.factor;

          // Apply terrain factor to APRS-refined or band radius
          if (maxAprsDistance > 0 && maxAprsDistance > bandRadius * 0.5) {
            coverageRadius = Math.min(Math.max(bandRadius, maxAprsDistance * 1.1), 150) * terrainFactor;
            source = "terrain_adjusted";
            refinementPct = Math.min(100, 50 + stationCount * 6 + Math.round((terrainFactor - 1) * 50));
            terrainAdjusted++;
          } else {
            coverageRadius = bandRadius * terrainFactor;
            source = "terrain_adjusted";
            refinementPct = Math.min(80, 35 + Math.round((terrainFactor - 1) * 50));
            terrainAdjusted++;
          }
        } else if (maxAprsDistance > 0 && maxAprsDistance > bandRadius * 0.5) {
          // No elevation data, fall back to APRS refinement
          coverageRadius = Math.min(Math.max(bandRadius, maxAprsDistance * 1.1), 150);
          source = "aprs_refined";
          refinementPct = Math.min(100, 40 + stationCount * 6);
          aprsRefined++;
        } else {
          bandEstimated++;
        }
      } else {
        if (maxAprsDistance > 0 && maxAprsDistance > bandRadius * 0.5) {
          coverageRadius = Math.min(Math.max(bandRadius, maxAprsDistance * 1.1), 150);
          source = "aprs_refined";
          refinementPct = Math.min(100, 40 + stationCount * 6);
          aprsRefined++;
        } else {
          bandEstimated++;
        }
      }

      // Clamp coverage to reasonable range
      coverageRadius = Math.max(5, Math.min(200, coverageRadius));

      if (r.coverage_radius_km !== coverageRadius || r.coverage_source !== source ||
          r.coverage_refinement_pct !== refinementPct || r.needs_recalc || force ||
          r.elevation_m !== elevationM || r.terrain_factor !== terrainFactor) {
        updates.push({
          id: r.id,
          coverage_radius_km: coverageRadius,
          coverage_source: source,
          coverage_refinement_pct: refinementPct,
          coverage_updated: now,
          needs_recalc: false,
          elevation_m: elevationM,
          terrain_factor: terrainFactor,
        });
      }
    }

    // Bulk update in batches of 500
    let updatedCount = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.Repeater.bulkUpdate(batch);
      updatedCount += batch.length;
    }

    // Compute global progress statistics across ALL repeaters
    const allWithCoords = allRepeaters.filter((r: any) => r.lat != null && r.lng != null);
    const allCalculated = allWithCoords.filter((r: any) => r.coverage_updated != null || updates.some(u => u.id === r.id));
    const allAprsRefined = allWithCoords.filter((r: any) =>
      r.coverage_source === "aprs_refined" || r.coverage_source === "terrain_adjusted" ||
      updates.some(u => u.id === r.id && (u.coverage_source === "aprs_refined" || u.coverage_source === "terrain_adjusted"))
    );
    const allTerrainAdjusted = allWithCoords.filter((r: any) =>
      r.coverage_source === "terrain_adjusted" ||
      updates.some(u => u.id === r.id && u.coverage_source === "terrain_adjusted")
    );
    const avgRefinement = allWithCoords.length > 0
      ? Math.round(allWithCoords.reduce((sum: number, r: any) => {
          const update = updates.find(u => u.id === r.id);
          return sum + (update?.coverage_refinement_pct ?? r.coverage_refinement_pct ?? 0);
        }, 0) / allWithCoords.length)
      : 0;

    // Per-country progress
    const countryProgress: Record<string, { total: number; calculated: number; aprsRefined: number; terrainAdjusted: number; avgPct: number }> = {};
    for (const r of allRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      const cc = r.country_code || '?';
      if (!countryProgress[cc]) countryProgress[cc] = { total: 0, calculated: 0, aprsRefined: 0, terrainAdjusted: 0, avgPct: 0 };
      countryProgress[cc].total++;
      const update = updates.find(u => u.id === r.id);
      const pct = update?.coverage_refinement_pct ?? r.coverage_refinement_pct ?? 0;
      const isCalculated = update != null || r.coverage_updated != null;
      const isAprsRefined = update?.coverage_source === "aprs_refined" || update?.coverage_source === "terrain_adjusted" ||
        (update == null && (r.coverage_source === "aprs_refined" || r.coverage_source === "terrain_adjusted"));
      const isTerrainAdjusted = update?.coverage_source === "terrain_adjusted" ||
        (update == null && r.coverage_source === "terrain_adjusted");
      if (isCalculated) countryProgress[cc].calculated++;
      if (isAprsRefined) countryProgress[cc].aprsRefined++;
      if (isTerrainAdjusted) countryProgress[cc].terrainAdjusted++;
      countryProgress[cc].avgPct += pct;
    }
    for (const cc of Object.keys(countryProgress)) {
      const cp = countryProgress[cc];
      cp.avgPct = cp.total > 0 ? Math.round(cp.avgPct / cp.total) : 0;
    }

    // Count pending recalc requests
    const pendingRecalc = allRepeaters.filter((r: any) => r.needs_recalc === true).length;

    return Response.json({
      success: true,
      scope: expand || countryCode === "all" ? "worldwide" : countryCode,
      total: repeaters.length,
      bandEstimated,
      aprsRefined,
      terrainAdjusted,
      skipped,
      updated: updatedCount,
      pendingRecalc,
      global: {
        totalRepeaters: allRepeaters.length,
        withCoords: allWithCoords.length,
        calculated: allCalculated.length,
        aprsRefined: allAprsRefined.length,
        terrainAdjusted: allTerrainAdjusted.length,
        avgRefinementPct: avgRefinement,
        countriesCovered: Object.keys(countryProgress).length,
      },
      countryProgress,
    });
  } catch (e: any) {
    console.error("calculateRepeaterCoverage error:", e);
    return Response.json({ error: e?.message || "Unbekannter Fehler" }, { status: 500 });
  }
}
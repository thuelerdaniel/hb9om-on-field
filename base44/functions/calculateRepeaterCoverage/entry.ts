import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Background coverage calculator for repeaters.
// Starts with Switzerland (CH) by default, expands to more countries on demand.
// Refinement: band estimate → APRS-refined (based on station density).
// Returns progress statistics for the admin dashboard.

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

export default async function(req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const force = req.body?.force === true;
    // country_code: "CH" (default), specific code, or "all" for worldwide
    const countryCode = req.body?.country_code || "CH";
    const expand = req.body?.expand === true;

    // Auth: allow service-role (no user = automation) or admin user
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Fetch all repeaters
    const allRepeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 10000);

    // Filter by country if not expanding
    let repeaters: any[];
    if (expand || countryCode === "all") {
      repeaters = allRepeaters;
    } else {
      repeaters = allRepeaters.filter((r: any) => r.country_code === countryCode);
    }

    // Fetch APRS stations (PrivateNodes) for distance-based refinement
    const aprsStations = await base44.asServiceRole.entities.PrivateNode.list("-created_date", 10000);
    const stationsWithCoords = (aprsStations || []).filter((n: any) => n.lat != null && n.lng != null);

    const now = new Date().toISOString();
    const updates: any[] = [];
    let bandEstimated = 0;
    let aprsRefined = 0;
    let skipped = 0;

    for (const r of repeaters) {
      if (r.lat == null || r.lng == null) { skipped++; continue; }

      // Skip already APRS-refined unless force refresh
      if (r.coverage_source === "aprs_refined" && !force) { skipped++; continue; }
      // Skip manual overrides unless force refresh
      if (r.coverage_source === "manual" && !force) { skipped++; continue; }

      const bandRadius = COVERAGE_RADIUS_KM[r.band] || COVERAGE_RADIUS_KM["Other"];

      // APRS refinement: count stations within 150 km and find max distance
      let maxAprsDistance = 0;
      let stationCount = 0;
      for (const station of stationsWithCoords) {
        const dist = haversineKm(r.lat, r.lng, station.lat, station.lng);
        if (dist <= 150) {
          stationCount++;
          if (dist > maxAprsDistance) {
            maxAprsDistance = dist;
          }
        }
      }

      let coverageRadius = bandRadius;
      let source = "band_estimate";
      let refinementPct = 20; // band estimate = 20% confidence

      if (maxAprsDistance > 0 && maxAprsDistance > bandRadius * 0.5) {
        coverageRadius = Math.min(Math.max(bandRadius, maxAprsDistance * 1.1), 150);
        source = "aprs_refined";
        // Refinement: 40% base + 6% per station, capped at 100%
        refinementPct = Math.min(100, 40 + stationCount * 6);
        aprsRefined++;
      } else if (stationCount > 0) {
        // Some APRS stations found but not enough for full refinement
        refinementPct = Math.min(35, 20 + stationCount * 3);
        bandEstimated++;
      } else {
        bandEstimated++;
      }

      if (r.coverage_radius_km !== coverageRadius || r.coverage_source !== source || r.coverage_refinement_pct !== refinementPct || force) {
        updates.push({
          id: r.id,
          coverage_radius_km: coverageRadius,
          coverage_source: source,
          coverage_refinement_pct: refinementPct,
          coverage_updated: now,
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

    // Compute global progress statistics across ALL repeaters (not just filtered)
    const allWithCoords = allRepeaters.filter((r: any) => r.lat != null && r.lng != null);
    const allCalculated = allWithCoords.filter((r: any) => r.coverage_updated != null || updates.some(u => u.id === r.id));
    const allAprsRefined = allWithCoords.filter((r: any) => r.coverage_source === "aprs_refined" || updates.some(u => u.id === r.id && u.coverage_source === "aprs_refined"));
    const avgRefinement = allWithCoords.length > 0
      ? Math.round(allWithCoords.reduce((sum: number, r: any) => {
          const update = updates.find(u => u.id === r.id);
          return sum + (update?.coverage_refinement_pct ?? r.coverage_refinement_pct ?? 0);
        }, 0) / allWithCoords.length)
      : 0;

    // Per-country progress
    const countryProgress: Record<string, { total: number; calculated: number; aprsRefined: number; avgPct: number }> = {};
    for (const r of allRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      const cc = r.country_code || '?';
      if (!countryProgress[cc]) countryProgress[cc] = { total: 0, calculated: 0, aprsRefined: 0, avgPct: 0 };
      countryProgress[cc].total++;
      const update = updates.find(u => u.id === r.id);
      const pct = update?.coverage_refinement_pct ?? r.coverage_refinement_pct ?? 0;
      const isCalculated = update != null || r.coverage_updated != null;
      const isAprsRefined = update?.coverage_source === "aprs_refined" || (update == null && r.coverage_source === "aprs_refined");
      if (isCalculated) countryProgress[cc].calculated++;
      if (isAprsRefined) countryProgress[cc].aprsRefined++;
      countryProgress[cc].avgPct += pct;
    }
    for (const cc of Object.keys(countryProgress)) {
      const cp = countryProgress[cc];
      cp.avgPct = cp.total > 0 ? Math.round(cp.avgPct / cp.total) : 0;
    }

    return Response.json({
      success: true,
      scope: expand || countryCode === "all" ? "worldwide" : countryCode,
      total: repeaters.length,
      bandEstimated,
      aprsRefined,
      skipped,
      updated: updatedCount,
      // Global progress across ALL repeaters
      global: {
        totalRepeaters: allRepeaters.length,
        withCoords: allWithCoords.length,
        calculated: allCalculated.length,
        aprsRefined: allAprsRefined.length,
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
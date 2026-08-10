import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Background coverage calculator for repeaters.
// Starts with band-based estimates, refines over time using APRS station density.
// Run via scheduled automation (daily) or manually from Admin panel.

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

    // Auth: allow service-role (no user = automation) or admin user
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Fetch all repeaters
    const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 10000);

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

      // APRS refinement: find the max distance of APRS-active stations near the repeater.
      // Stations within 150 km that are actively reporting via APRS give a lower-bound
      // estimate of the repeater's actual coverage area.
      let maxAprsDistance = 0;
      for (const station of stationsWithCoords) {
        const dist = haversineKm(r.lat, r.lng, station.lat, station.lng);
        if (dist <= 150 && dist > maxAprsDistance) {
          maxAprsDistance = dist;
        }
      }

      let coverageRadius = bandRadius;
      let source = "band_estimate";

      if (maxAprsDistance > 0 && maxAprsDistance > bandRadius * 0.5) {
        coverageRadius = Math.min(Math.max(bandRadius, maxAprsDistance * 1.1), 150);
        source = "aprs_refined";
        aprsRefined++;
      } else {
        bandEstimated++;
      }

      if (r.coverage_radius_km !== coverageRadius || r.coverage_source !== source || force) {
        updates.push({
          id: r.id,
          coverage_radius_km: coverageRadius,
          coverage_source: source,
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

    return Response.json({
      success: true,
      total: repeaters.length,
      bandEstimated,
      aprsRefined,
      skipped,
      updated: updatedCount,
    });
  } catch (e: any) {
    console.error("calculateRepeaterCoverage error:", e);
    return Response.json({ error: e?.message || "Unbekannter Fehler" }, { status: 500 });
  }
}
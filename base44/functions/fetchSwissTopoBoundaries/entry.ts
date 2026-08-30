import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from "../../shared/internalAuth.ts";
import {
  isInSwitzerland,
  identifyAtPoint,
  searchSwissNames,
  extractPolygon,
  simplifyPolygon,
  SWISSTOPO_LAYERS,
} from "../../shared/swissTopoApi.ts";

// Fetches boundary/point data from SwissTopo for Swiss references.
//
// Supported types:
//   - "bln":   BLN protected landscape boundary (polygon) — for POTA/WWFF park contours
//   - "sota":  SwissNames3D peak data (point + elevation) — for SOTA summit enrichment
//   - "lake":  Water body polygon — for LLOTA lake contours
//
// For "bln" and "lake": returns { success, polygon, name, source: 'swisstopo' }
// For "sota": returns { success, peaks: [{ name, lat, lng, elevation, objectclass }] }
//
// SwissTopo API: https://api3.geo.admin.ch/rest/services/ech/

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, lat, lng, name, radius } = body;
    if (!type) {
      return Response.json(
        { error: "Missing 'type' parameter (bln, sota, or lake)" },
        { status: 400 },
      );
    }

    // All SwissTopo queries require coordinates within Switzerland
    if (lat == null || lng == null || !isInSwitzerland(lat, lng)) {
      return Response.json({
        success: false,
        error: "Coordinates not in Switzerland or missing lat/lng",
        type,
      }, { status: 400 });
    }

    // BLN boundaries can be large — use a generous search radius (2km default)
    // to ensure the bounding box intersects the protected area polygon.
    const tolerance = radius || (type === 'bln' ? 2000 : 500);

    // --- BLN: Protected landscape boundary (polygon) ---
    if (type === "bln") {
      const features = await identifyAtPoint(
        lat,
        lng,
        [SWISSTOPO_LAYERS.BLN, SWISSTOPO_LAYERS.BIOTOP, SWISSTOPO_LAYERS.MOOR, SWISSTOPO_LAYERS.AUEN],
        tolerance,
      );
      for (const feature of features) {
        const poly = extractPolygon(feature);
        if (poly && poly.length >= 3) {
          const simplified = simplifyPolygon(poly);
          const featureName =
            feature.properties?.bln_name ||
            feature.properties?.label ||
            feature.properties?.name ||
            "";
          return Response.json({
            success: true,
            type: "bln",
            polygon: simplified,
            name: featureName,
            layer: feature.layerBodId || feature.properties?.layer || "",
            source: "swisstopo",
          });
        }
      }
      return Response.json({
        success: false,
        error: "No BLN/biotope/moor boundary found at coordinates",
        type: "bln",
        lat,
        lng,
        debug: { featureCount: features.length, tolerance, layers: [SWISSTOPO_LAYERS.BLN, SWISSTOPO_LAYERS.BIOTOP, SWISSTOPO_LAYERS.MOOR, SWISSTOPO_LAYERS.AUEN] },
      }, { status: 404 });
    }

    // --- Lake: Water body polygon ---
    if (type === "lake") {
      const features = await identifyAtPoint(
        lat,
        lng,
        [SWISSTOPO_LAYERS.WATER],
        tolerance,
      );
      for (const feature of features) {
        const poly = extractPolygon(feature);
        if (poly && poly.length >= 3) {
          const simplified = simplifyPolygon(poly);
          const featureName =
            feature.properties?.label ||
            feature.properties?.name ||
            "";
          return Response.json({
            success: true,
            type: "lake",
            polygon: simplified,
            name: featureName,
            layer: feature.layerBodId || "",
            source: "swisstopo",
          });
        }
      }
      return Response.json({
        success: false,
        error: "No water body polygon found at coordinates",
        type: "lake",
        lat,
        lng,
      }, { status: 404 });
    }

    // --- SOTA: SwissNames3D peak data ---
    if (type === "sota") {
      // If we have a name, search SwissNames3D for it
      if (name) {
        const results = await searchSwissNames(name, 20);
        const peaks = results
          .filter((r: any) => {
            const objclass = r.attrs?.objectclass || "";
            // Filter for mountain-related features
            return (
              objclass.includes("BERG") ||
              objclass.includes("GIPFEL") ||
              objclass.includes("PASS") ||
              objclass.includes("HUEGEL") ||
              objclass.includes("KAMM") ||
              objclass.includes("RUECKEN")
            );
          })
          .map((r: any) => ({
            name: r.attrs?.label?.replace(/<[^>]*>/g, "") || "",
            lat: r.attrs?.lat,
            lng: r.attrs?.lon,
            elevation: r.attrs?.height || r.attrs?.alt || null,
            objectclass: r.attrs?.objectclass || "",
          }))
          .filter((p: any) => p.lat != null && p.lng != null);

        if (peaks.length > 0) {
          return Response.json({
            success: true,
            type: "sota",
            peaks,
            source: "swisstopo",
          });
        }
      }

      // Fallback: identify features at the given coordinates
      const features = await identifyAtPoint(
        lat,
        lng,
        [SWISSTOPO_LAYERS.SWISSNAMES],
        tolerance,
      );
      const peaks = features
        .filter((f: any) => {
          const objclass =
            f.properties?.objectclass || f.attrs?.objectclass || "";
          return (
            objclass.includes("BERG") ||
            objclass.includes("GIPFEL") ||
            objclass.includes("PASS") ||
            objclass.includes("HUEGEL") ||
            objclass.includes("KAMM") ||
            objclass.includes("RUECKEN")
          );
        })
        .map((f: any) => ({
          name:
            f.properties?.label?.replace(/<[^>]*>/g, "") ||
            f.properties?.name ||
            "",
          lat: f.properties?.lat || f.geometry?.coordinates?.[1],
          lng: f.properties?.lon || f.geometry?.coordinates?.[0],
          elevation: f.properties?.height || f.properties?.alt || null,
          objectclass: f.properties?.objectclass || "",
        }))
        .filter((p: any) => p.lat != null && p.lng != null);

      if (peaks.length > 0) {
        return Response.json({
          success: true,
          type: "sota",
          peaks,
          source: "swisstopo",
        });
      }

      return Response.json({
        success: false,
        error: "No peak found in SwissNames3D",
        type: "sota",
        lat,
        lng,
      }, { status: 404 });
    }

    return Response.json(
      { error: `Unknown type: ${type}. Use 'bln', 'sota', or 'lake'.` },
      { status: 400 },
    );
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 },
    );
  }
}
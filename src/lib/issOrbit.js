// ISS Orbital Model — per-frame position calculation using API-calibrated extrapolation.
// Fetches ground truth from API every 30s, extrapolates smoothly between updates.

let lastPos = null;   // { lat, lon, time }
let prevPos = null;   // { lat, lon, time }

export function calibrateIssFromApi(lat, lon, timestamp = Date.now()) {
  if (lastPos) prevPos = lastPos;
  lastPos = { lat, lon, time: timestamp };
}

export function hasIssCalibration() {
  return lastPos != null;
}

/**
 * Calculates ISS 3D position for the given date.
 * Uses linear extrapolation from the last two API positions for smooth per-frame motion.
 * @param {Date} date
 * @param {number} globeRadius - Globe radius in Three.js units (default 1.0)
 * @returns {{ x, y, z, lat, lon, altitude, velocity } | null}
 */
export function calculateISSPosition(date = new Date(), globeRadius = 1.0) {
  if (!lastPos) return null;

  let lat, lon;
  if (prevPos && lastPos) {
    const dt = (lastPos.time - prevPos.time) / 1000; // seconds between API updates
    if (dt > 0.5) {
      const dLat = lastPos.lat - prevPos.lat;
      let dLon = lastPos.lon - prevPos.lon;
      // Handle longitude wrap-around
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      const elapsed = (date.getTime() - lastPos.time) / 1000;
      lat = lastPos.lat + (dLat / dt) * elapsed;
      lon = lastPos.lon + (dLon / dt) * elapsed;
      // Wrap longitude to [-180, 180]
      lon = ((lon + 180) % 360 + 360) % 360 - 180;
    } else {
      lat = lastPos.lat;
      lon = lastPos.lon;
    }
  } else {
    lat = lastPos.lat;
    lon = lastPos.lon;
  }

  // Clamp latitude
  lat = Math.max(-90, Math.min(90, lat));

  // Convert lat/lon to 3D position (same convention as latLonToVec3 in HuntingGlobe)
  const altitudeFactor = 1.06; // (6371 + 408) / 6371 ≈ 1.064
  const r = globeRadius * altitudeFactor;
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;

  return {
    x: -r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
    lat,
    lon,
    altitude: 408,
    velocity: 27600,
  };
}
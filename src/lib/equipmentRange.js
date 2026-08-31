// equipmentRange.js — Reichweitenberechnung basierend auf Equipment-Typ und Band.
// Ersetzt den festen Reichweiten-Slider durch dynamische Berechnung.

export function calculateRange(equipmentType, band) {
  const ranges = {
    mobil: { "2m": 80, "70cm": 50, "10m": 150, "23cm": 30, "6m": 100, "4m": 60 },
    portable: { "2m": 15, "70cm": 10, "10m": 30, "23cm": 5, "6m": 20, "4m": 12 },
  };
  return ranges[equipmentType]?.[band] || 25;
}

export function isRepeaterReachable(distance, equipmentType, repeaterBand) {
  const userRange = calculateRange(equipmentType, repeaterBand);
  return distance <= userRange;
}

// Maximale Reichweite über alle ausgewählten Bänder (für Bounding-Box).
export function maxRangeForBands(equipmentType, selectedBands) {
  if (!selectedBands || selectedBands.length === 0) {
    return equipmentType === "mobil" ? 80 : 15;
  }
  return Math.max(...selectedBands.map((b) => calculateRange(equipmentType, b)));
}
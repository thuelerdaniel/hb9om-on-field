// Hear-Probability-Score (0-100%) — Wahrscheinlichkeit die Station zu hören.
// Faktoren: Distanz (40%), Propagation (35%), Standort (15%), Band (10%).

export function calcHearScore(spot, stationPos, propagation) {
  const dist = spot._calcDist || spot.distance || 0;

  // Distanz-Faktor (40%)
  let distScore;
  if (dist > 0 && dist < 500) distScore = 40;
  else if (dist < 1500) distScore = 30;
  else if (dist < 3000) distScore = 20;
  else if (dist < 5000) distScore = 10;
  else if (dist > 0) distScore = 5;
  else distScore = 15; // Keine Distanz bekannt — mittlerer Wert

  // Propagation-Faktor (35%) — nutze confidence + Tag/Nacht
  const conf = spot.confidence || 50;
  let propScore = (conf / 100) * 30;
  const hour = new Date().getUTCHours();
  const isDay = hour >= 6 && hour <= 18;
  if (isDay && dist >= 3000 && dist <= 10000) propScore += 5; // F2-Layer tagsüber
  if (!isDay && dist > 0 && dist < 2000) propScore += 3; // E-Layer nachts
  propScore = Math.min(35, propScore);

  // Standort-Faktor (15%) — SOTA/POTA-Berge haben bessere Ausbreitung
  let locScore = 5;
  const actType = spot.activity || spot.activity_type;
  if (actType === 'SOTA') {
    locScore = 10;
    if (spot.altitude_m != null) {
      if (spot.altitude_m > 1000) locScore = 15;
      else if (spot.altitude_m > 500) locScore = 12;
    } else {
      locScore = 12; // SOTA-Spots sind per Definition auf Bergen
    }
  } else if (actType === 'POTA') {
    locScore = 8;
  }

  // Band/Frequenz-Faktor (10%)
  let bandScore = 5;
  const band = spot.band || '';
  if (['40m', '20m', '15m', '10m'].includes(band)) bandScore = 10;
  else if (['80m', '160m'].includes(band)) bandScore = 7;
  else if (['2m', '70cm'].includes(band)) bandScore = 5;
  else if (band) bandScore = 6;

  const total = Math.round(distScore + propScore + locScore + bandScore);
  return Math.min(100, Math.max(0, total));
}

export function scoreColor(score) {
  if (score > 70) return '#22c55e'; // grün
  if (score >= 40) return '#ffc400'; // gelb
  return '#ef4444'; // rot
}
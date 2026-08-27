// Hear-Probability-Score (0-100%) — Wahrscheinlichkeit die Station zu hören.
// Fix 8: Differenzierte Scoring-Formel mit kontinuierlicher Distanz, Alter, Confidence.
// Faktoren: Distanz (30%), Alter (20%), Confidence (20%), Aktivität (15%), Band/Propagation (15%).

export function calcHearScore(spot, stationPos, propagation) {
  const dist = spot._calcDist || spot.distance || 0;

  // Distanz-Faktor (30%) — kontinuierliche Exponentialfunktion: näher = höher
  let distScore;
  if (dist > 0) {
    distScore = Math.round(30 * Math.exp(-dist / 2000));
  } else {
    distScore = 10; // Keine Distanz bekannt
  }

  // Alter-Faktor (20%) — neuere Spots = höherer Score
  const age = spot.age_seconds || 0;
  let ageScore;
  if (age < 60) ageScore = 20;
  else if (age < 300) ageScore = 15;
  else if (age < 600) ageScore = 10;
  else if (age < 1800) ageScore = 5;
  else ageScore = 2;

  // Confidence-Faktor (20%)
  const conf = spot.confidence || 50;
  const confScore = Math.round((conf / 100) * 20);

  // Aktivität/Standort-Faktor (15%)
  const actType = spot.activity || spot.activity_type;
  let locScore = 5;
  if (actType === 'SOTA') {
    locScore = 12;
    if (spot.altitude_m != null && spot.altitude_m > 1000) locScore = 15;
  } else if (actType === 'POTA') {
    locScore = 8;
  } else if (actType === 'WWFF') {
    locScore = 7;
  } else if (actType === 'IOTA') {
    locScore = 10;
  }

  // Band/Propagation-Faktor (15%)
  let bandScore = 5;
  const band = spot.band || '';
  if (['20m', '40m'].includes(band)) bandScore = 12;
  else if (['15m', '10m'].includes(band)) bandScore = 10;
  else if (['80m', '160m'].includes(band)) bandScore = 8;
  else if (['2m', '70cm'].includes(band)) bandScore = 3;
  else if (band) bandScore = 7;

  // Propagation-Daten falls verfügbar
  if (propagation?.bands?.length > 0) {
    const bandProp = propagation.bands.find(b => b.band === band);
    if (bandProp) {
      bandScore = Math.round((bandProp.score / 100) * 15);
    }
  }

  const total = Math.round(distScore + ageScore + confScore + locScore + bandScore);
  return Math.min(100, Math.max(0, total));
}

export function scoreColor(score) {
  if (score > 70) return '#22c55e'; // grün
  if (score >= 40) return '#ffc400'; // gelb
  return '#ef4444'; // rot
}
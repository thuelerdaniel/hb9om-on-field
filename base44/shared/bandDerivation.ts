// Gemeinsame Band-Ableitung aus Frequenz (kHz).
// Wird von fetchDxSpots und ggf. anderen Functions genutzt.

export function deriveBand(freqKHz: number): string {
  if (freqKHz >= 1800 && freqKHz <= 2000) return '160m';
  if (freqKHz >= 3500 && freqKHz <= 4000) return '80m';
  if (freqKHz >= 5250 && freqKHz <= 5450) return '60m';
  if (freqKHz >= 7000 && freqKHz <= 7300) return '40m';
  if (freqKHz >= 10100 && freqKHz <= 10150) return '30m';
  if (freqKHz >= 14000 && freqKHz <= 14350) return '20m';
  if (freqKHz >= 18068 && freqKHz <= 18168) return '17m';
  if (freqKHz >= 21000 && freqKHz <= 21450) return '15m';
  if (freqKHz >= 24890 && freqKHz <= 24990) return '12m';
  if (freqKHz >= 28000 && freqKHz <= 29700) return '10m';
  if (freqKHz >= 50000 && freqKHz <= 54000) return '6m';
  if (freqKHz >= 144000 && freqKHz <= 148000) return '2m';
  return 'Unknown';
}

// Band-Condition-Berechnung aus Solar Flux und K-Index.
// Gibt Array von { band, score, condition } zurück.
export function calculateBandConditions(solarFlux: number, kIndex: number) {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const conditionFor = (score: number) =>
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

  const rawBands = [
    { band: '160m', score: clamp(50 - kIndex * 10) },
    { band: '80m',  score: clamp(60 - kIndex * 8) },
    { band: '60m',  score: clamp(65 - kIndex * 7) },
    { band: '40m',  score: clamp(75 - kIndex * 6) },
    { band: '30m',  score: clamp(80 - kIndex * 5) },
    { band: '20m',  score: clamp(60 + (solarFlux - 100) * 0.3 - kIndex * 5) },
    { band: '17m',  score: clamp(55 + (solarFlux - 100) * 0.35 - kIndex * 5) },
    { band: '15m',  score: clamp(50 + (solarFlux - 100) * 0.4 - kIndex * 6) },
    { band: '12m',  score: clamp(45 + (solarFlux - 100) * 0.4 - kIndex * 7) },
    { band: '10m',  score: clamp(40 + (solarFlux - 100) * 0.5 - kIndex * 8) },
    { band: '6m',   score: clamp(30 - kIndex * 5) },
  ];

  return rawBands.map(b => ({
    band: b.band,
    score: b.score,
    condition: conditionFor(b.score),
  }));
}
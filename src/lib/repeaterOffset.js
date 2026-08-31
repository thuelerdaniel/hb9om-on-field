// repeaterOffset — Normalisiert fehlerhafte offset_mhz Werte und berechnet Input-Frequenz.
// Fehlerhafte Werte: offset in kHz gespeichert (|offset| > 50), offset === 0, oder komplett falsch.

const STANDARD_OFFSETS = {
  "2m": -0.6,
  "70cm": -7.6,
  "10m": -0.1,
  "6m": -0.5,
  "4m": -0.5,
  "23cm": -12.0,
};

// Normalisiert einen offset_mhz Wert für die Anzeige.
// - |offset| > 50 → wahrscheinlich kHz statt MHz → teile durch 1000
// - offset === 0 oder null → Standard-Offset für das Band
export function normalizeOffset(offset, band) {
  if (offset == null || offset === 0) {
    return STANDARD_OFFSETS[band] || 0;
  }
  if (Math.abs(offset) > 50) {
    return offset / 1000;
  }
  return offset;
}

// Empfangsfrequenz (Input) = Sendefrequenz (Output) + Offset
export function getInputFrequency(frequency, offset) {
  if (frequency == null) return null;
  return frequency + offset;
}
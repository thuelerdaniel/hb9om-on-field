// 10 Radio-Turm-Symbol-Designs zur Auswahl.
// Jedes Design ist ein SVG auf 28x28 viewBox, gefüllt mit layer color.
// Design 1 ist aktuell aktiv (klassischer Gitterturm).

export const TOWER_DESIGNS = {
  1: {
    name: "Klassischer Gitterturm",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="10" y1="22" x2="14" y2="6"/>
        <line x1="18" y1="22" x2="14" y2="6"/>
        <line x1="11.5" y1="16" x2="16.5" y2="16"/>
        <line x1="10.8" y1="19" x2="17.2" y2="19"/>
        <line x1="14" y1="6" x2="14" y2="3"/>
        <line x1="11" y1="4" x2="17" y2="4"/>
      </g>
    </svg>`,
  },
  2: {
    name: "Turm mit Radar-Schüssel",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="11" y1="22" x2="14" y2="12"/>
        <line x1="17" y1="22" x2="14" y2="12"/>
        <path d="M9 8 Q14 4 19 8" stroke-width="2" fill="none"/>
        <line x1="14" y1="6" x2="14" y2="12"/>
        <line x1="11.5" y1="18" x2="16.5" y2="18"/>
      </g>
    </svg>`,
  },
  3: {
    name: "Turm mit Yagi-Antenne",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="11" y1="22" x2="14" y2="10"/>
        <line x1="17" y1="22" x2="14" y2="10"/>
        <line x1="14" y1="10" x2="14" y2="5"/>
        <line x1="8" y1="7" x2="20" y2="7"/>
        <line x1="9" y1="9" x2="19" y2="9"/>
        <line x1="10" y1="11" x2="18" y2="11"/>
        <line x1="11.5" y1="18" x2="16.5" y2="18"/>
      </g>
    </svg>`,
  },
  4: {
    name: "Mast mit Blinklicht",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="14" y1="22" x2="14" y2="7"/>
        <line x1="11" y1="22" x2="17" y2="22"/>
        <line x1="11" y1="18" x2="17" y2="18"/>
        <line x1="11.5" y1="14" x2="16.5" y2="14"/>
        <circle cx="14" cy="5" r="2" fill="${color}" stroke="none"/>
      </g>
    </svg>`,
  },
  5: {
    name: "Dreieck-Sendeturm",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <path d="M9 22 L14 6 L19 22 Z"/>
        <line x1="11" y1="16" x2="17" y2="16"/>
        <line x1="10" y1="19" x2="18" y2="19"/>
        <line x1="14" y1="6" x2="14" y2="3"/>
        <line x1="11" y1="4" x2="17" y2="4"/>
        <line x1="12.5" y1="9" x2="15.5" y2="9"/>
      </g>
    </svg>`,
  },
  6: {
    name: "Turm mit Satellitenschüssel",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="11" y1="22" x2="14" y2="14"/>
        <line x1="17" y1="22" x2="14" y2="14"/>
        <path d="M8 8 L14 10 L8 12 Z" fill="#EBF1F5" stroke="none"/>
        <line x1="14" y1="10" x2="14" y2="14"/>
        <line x1="11.5" y1="18" x2="16.5" y2="18"/>
      </g>
    </svg>`,
  },
  7: {
    name: "Turm mit gekreuzten Dipolen",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="2" stroke-linecap="round" fill="none">
        <line x1="14" y1="14" x2="7" y2="7"/>
        <line x1="14" y1="14" x2="21" y2="7"/>
        <line x1="14" y1="14" x2="14" y2="23"/>
        <line x1="11" y1="22" x2="14" y2="14"/>
        <line x1="17" y1="22" x2="14" y2="14"/>
      </g>
    </svg>`,
  },
  8: {
    name: "Minimalistische Silhouette",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <path d="M10 22 L14 5 L18 22 Z" fill="#EBF1F5" stroke="none"/>
      <line x1="14" y1="5" x2="14" y2="2" stroke="#EBF1F5" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="14" cy="2" r="1.5" fill="${color}" stroke="none"/>
    </svg>`,
  },
  9: {
    name: "Turm mit Signalwellen",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="11" y1="22" x2="14" y2="10"/>
        <line x1="17" y1="22" x2="14" y2="10"/>
        <line x1="11.5" y1="17" x2="16.5" y2="17"/>
        <path d="M6 6 Q4 8 6 10" stroke-width="1.5" fill="none"/>
        <path d="M22 6 Q24 8 22 10" stroke-width="1.5" fill="none"/>
        <path d="M4 4 Q1 8 4 12" stroke-width="1.5" fill="none" opacity="0.6"/>
        <path d="M24 4 Q27 8 24 12" stroke-width="1.5" fill="none" opacity="0.6"/>
      </g>
    </svg>`,
  },
  10: {
    name: "Turm mit Blitzsymbol",
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#253140" stroke="${color}" stroke-width="2.5"/>
      <g stroke="#EBF1F5" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="11" y1="22" x2="14" y2="12"/>
        <line x1="17" y1="22" x2="14" y2="12"/>
        <line x1="11.5" y1="17" x2="16.5" y2="17"/>
      </g>
      <path d="M15 5 L11 10 L14 10 L12 14 L17 8 L14 8 Z" fill="${color}" stroke="none"/>
    </svg>`,
  },
};

export function getTowerDesignSvg(designNum, color) {
  const design = TOWER_DESIGNS[designNum] || TOWER_DESIGNS[1];
  return design.svg(color);
}

export function getTowerDesignName(designNum) {
  const design = TOWER_DESIGNS[designNum] || TOWER_DESIGNS[1];
  return design.name;
}
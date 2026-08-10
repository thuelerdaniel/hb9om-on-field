// APRS-Standard Symbole für Node-Typen
// Basierend auf dem APRS Symbol Set (aprs.org/symbols)
// Jeder Node-Typ erhält sein eigenes SVG, das dem APRS-Standard entspricht.

export const APRS_SYMBOLS = {
  hotspot: {
    // APRS Haus-Symbol (für Home/Hotspot-Stationen)
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4 L4 13 L6.5 13 L6.5 24 L21.5 24 L21.5 13 L24 13 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="11" y="16" width="6" height="8" fill="white" opacity="0.5"/>
    </svg>`,
    name: "Haus (Hotspot)",
    aprsCode: "/H"
  },
  simplex_node: {
    // APRS Radio/Simplex-Symbol
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M8 16 Q14 9 20 16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="14" cy="14" r="2.5" fill="white"/>
    </svg>`,
    name: "Radio (Simplex)",
    aprsCode: "/r"
  },
  repeater_node: {
    // APRS Digipeater — 4-zackiger Stern (Kompassrose)
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L17 11 L26 14 L17 17 L14 26 L11 17 L2 14 L11 11 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    name: "Stern (Digipeater)",
    aprsCode: "/#"
  },
  allstar_node: {
    // APRS Node — Stern mit A-Overlay
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L17 11 L26 14 L17 17 L14 26 L11 17 L2 14 L11 11 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="14" y="18" text-anchor="middle" fill="white" font-size="9" font-weight="bold">A</text>
    </svg>`,
    name: "Stern mit A (AllStar)",
    aprsCode: "/n"
  },
  echolink_node: {
    // APRS IGate — Stern mit I-Overlay
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L17 11 L26 14 L17 17 L14 26 L11 17 L2 14 L11 11 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="14" y="18" text-anchor="middle" fill="white" font-size="9" font-weight="bold">I</text>
    </svg>`,
    name: "Stern mit I (IGate)",
    aprsCode: "/i"
  },
  weather_station: {
    // APRS Wetterstation — Quadrat mit W
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="20" height="20" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      <text x="14" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold">W</text>
    </svg>`,
    name: "Quadrat mit W (Wetter)",
    aprsCode: "/W"
  },
  other: {
    // APRS Default — Kreis
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="9" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="4" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Kreis (Sonstiges)",
    aprsCode: "/O"
  }
};

export function getAprsSymbolSvg(nodeType, color) {
  const symbol = APRS_SYMBOLS[nodeType] || APRS_SYMBOLS.other;
  return symbol.svg(color);
}

export function getAprsSymbolName(nodeType) {
  const symbol = APRS_SYMBOLS[nodeType] || APRS_SYMBOLS.other;
  return symbol.name;
}
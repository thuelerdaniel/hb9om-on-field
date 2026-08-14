// APRS-Standard Symbole für Node-Typen
// Basierend auf dem APRS Symbol Set (aprs.org/symbols)
// Jeder Node-Typ erhält sein eigenes SVG, das dem APRS-Standard entspricht.
// Umfasst feste Stationen (Digipeater, IGate, Wetter) UND mobile Objekte (Auto, Boot, Flugzeug, Fussgänger, Fahrrad).

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
  mobile: {
    // APRS Mobile — Pfeil/Positionsanzeige
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="9" fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M14 7 L18 16 L14 14 L10 16 Z" fill="white"/>
    </svg>`,
    name: "Pfeil (Mobile)",
    aprsCode: "/>"
  },
  car: {
    // APRS Auto
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 16 L7 11 Q7.5 9 10 9 L18 9 Q20.5 9 21 11 L23 16 L23 20 Q23 21 22 21 L21 21 Q21 22 20 22 L18 22 Q17 22 17 21 L11 21 Q11 22 10 22 L8 22 Q7 22 7 21 L6 21 Q5 21 5 20 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="9.5" cy="18.5" r="1.8" fill="white"/>
      <circle cx="18.5" cy="18.5" r="1.8" fill="white"/>
      <rect x="9" y="11" width="10" height="4" fill="white" opacity="0.4" rx="1"/>
    </svg>`,
    name: "Auto (Mobile)",
    aprsCode: "/>"
  },
  bike: {
    // APRS Fahrrad
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="20" r="4" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M8 20 L13 12 L18 20 M13 12 L16 12 M11 12 L15 12" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8" cy="20" r="1" fill="${color}"/>
      <circle cx="20" cy="20" r="1" fill="${color}"/>
    </svg>`,
    name: "Fahrrad (Mobile)",
    aprsCode: "/<"
  },
  boat: {
    // APRS Boot/Schiff
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 18 L24 18 L22 22 L6 22 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 18 L14 6 L20 16" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    name: "Boot (Mobile)",
    aprsCode: "/Y"
  },
  aircraft: {
    // APRS Flugzeug
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 3 L16 12 L25 14 L16 16 L14 25 L12 16 L3 14 L12 12 Z" fill="${color}" stroke="white" stroke-width="1.2" stroke-linejoin="round" transform="rotate(45 14 14)"/>
    </svg>`,
    name: "Flugzeug (Mobile)",
    aprsCode: "/A"
  },
  walker: {
    // APRS Fussgänger/Person
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="7" r="3" fill="${color}" stroke="white" stroke-width="1.2"/>
      <path d="M14 10 L14 18 M14 12 L10 15 M14 12 L18 15 M14 18 L11 24 M14 18 L17 24" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`,
    name: "Fussgänger (Mobile)",
    aprsCode: "//"
  },
  dot: {
    // Einfacher Punkt — Standard für öffentliche GPS-Position
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="6" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>`,
    name: "Punkt (Standard)",
    aprsCode: "/O"
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
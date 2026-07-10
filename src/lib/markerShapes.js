// Shared marker shape definitions for each reference layer type.
// Each shape is an SVG drawn on a 28x28 viewBox, filled with the layer color.

export const MARKER_SHAPES = {
  sota: {
    // Mountain with summit cross
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 3 L25 24 L3 24 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 9 L18 16 L10 16 Z" fill="white" opacity="0.35"/>
      <path d="M14 5 L14 9 M12 7 L16 7" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    name: "Berg (Dreieck)"
  },
  pota: {
    // Tree
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L8 10 L10 10 L6 16 L10 16 L6 22 L22 22 L18 16 L22 16 L18 10 L20 10 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="12.5" y="22" width="3" height="4" fill="${color}" stroke="white" stroke-width="1"/>
    </svg>`,
    name: "Baum"
  },
  hbff: {
    // Flower
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="7" r="4" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="7" cy="14" r="4" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="21" cy="14" r="4" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="14" cy="21" r="4" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="14" cy="14" r="3.5" fill="white"/>
      <circle cx="14" cy="14" r="2" fill="${color}"/>
    </svg>`,
    name: "Blume"
  },
  wwbota: {
    // Military bunker – half-dome with slit
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 24 L3 14 Q3 5 14 5 Q25 5 25 14 L25 24 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="10" y="12" width="8" height="2.5" fill="white" opacity="0.8" rx="0.5"/>
      <rect x="6" y="20" width="3" height="4" fill="white" opacity="0.3" rx="0.5"/>
      <rect x="19" y="20" width="3" height="4" fill="white" opacity="0.3" rx="0.5"/>
      <line x1="3" y1="24" x2="25" y2="24" stroke="white" stroke-width="1.5"/>
    </svg>`,
    name: "Bunker"
  },
  castle: {
    // Castle with battlements and gate
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 25 L3 10 L5 10 L5 6 L8 6 L8 10 L10 10 L10 6 L13 6 L13 10 L15 10 L15 6 L18 6 L18 10 L20 10 L20 6 L23 6 L23 10 L25 10 L25 25 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 25 L12 18 Q12 16 14 16 Q16 16 16 18 L16 25 Z" fill="white" opacity="0.5"/>
      <rect x="6" y="17" width="2.5" height="2.5" fill="white" opacity="0.4"/>
      <rect x="19.5" y="17" width="2.5" height="2.5" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Burg/Schloss"
  },
  iota: {
    // Diamond (island) with wave underneath
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L24 12 L14 22 L4 12 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 7 L19 12 L14 17 L9 12 Z" fill="white" opacity="0.35"/>
      <path d="M2 25 Q5 23 8 25 T14 25 T20 25 T26 25" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
    </svg>`,
    name: "Raute (Insel)"
  },
  lighthouse: {
    // Lighthouse with light beams
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 3 L17 3 L17 5 L16 6 L18 25 L10 25 L12 6 L11 5 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="12" y="8" width="4" height="3" fill="white" opacity="0.7" rx="0.5"/>
      <path d="M10 6 L4 4 M10 8 L3 8 M18 6 L24 4 M18 8 L25 8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.8"/>
    </svg>`,
    name: "Leuchtturm"
  },
  swiss_protected: {
    // Hexagon (nature reserve) with leaf inside
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L24 8 L24 20 L14 26 L4 20 L4 8 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 8 Q18 12 14 18 Q10 12 14 8 Z" fill="white" opacity="0.5"/>
    </svg>`,
    name: "Sechseck"
  },
  custom: {
    // Default circle pin
    svg: (color) => `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>`,
    name: "Kreis"
  }
};

export function getMarkerSvg(layerType, color) {
  const shape = MARKER_SHAPES[layerType] || MARKER_SHAPES.custom;
  return shape.svg(color);
}

export function getMarkerShapeName(layerType) {
  const shape = MARKER_SHAPES[layerType] || MARKER_SHAPES.custom;
  return shape.name;
}
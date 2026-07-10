// Shared marker shape definitions for each reference layer type.
// Each shape is an SVG path drawn on a 24x24 viewBox, filled with the layer color.

export const MARKER_SHAPES = {
  sota: {
    // Triangle (mountain summit)
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L21 20 L3 20 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 9 L16 16 L8 16 Z" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Dreieck"
  },
  pota: {
    // Tree
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L7 9 L9 9 L5 15 L9 15 L9 20 L15 20 L15 15 L19 15 L15 9 L17 9 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    name: "Baum"
  },
  hbff: {
    // Flower / leaf
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="6" r="3.5" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="6" cy="12" r="3.5" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="18" cy="12" r="3.5" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="12" cy="18" r="3.5" fill="${color}" stroke="white" stroke-width="1.2"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>`,
    name: "Blume"
  },
  wwbota: {
    // Bunker (dome on rectangle)
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 21 L4 11 Q4 5 12 5 Q20 5 20 11 L20 21 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="10" y="14" width="4" height="7" fill="white" opacity="0.5" rx="0.5"/>
      <rect x="5" y="17" width="2" height="2" fill="white" opacity="0.4"/>
      <rect x="17" y="17" width="2" height="2" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Bunker"
  },
  castle: {
    // Castle with battlements
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 L3 9 L5 9 L5 6 L7 6 L7 9 L9 9 L9 6 L11 6 L11 9 L13 9 L13 6 L15 6 L15 9 L17 9 L17 6 L19 6 L19 9 L21 9 L21 21 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="10.5" y="14" width="3" height="7" fill="white" opacity="0.5"/>
      <rect x="6" y="15" width="2" height="2" fill="white" opacity="0.4"/>
      <rect x="16" y="15" width="2" height="2" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Burg"
  },
  iota: {
    // Diamond (island)
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 7 L17 12 L12 17 L7 12 Z" fill="white" opacity="0.4"/>
    </svg>`,
    name: "Raute"
  },
  lighthouse: {
    // Lighthouse tower
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3 L14 3 L14 5 L13 6 L15 21 L9 21 L11 6 L10 5 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M6 9 L2 7 M6 11 L1 11 M18 9 L22 7 M18 11 L23 11" stroke="${color}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`,
    name: "Leuchtturm"
  },
  swiss_protected: {
    // Hexagon (nature reserve)
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 7 L12 17 M8 12 L16 12" stroke="white" opacity="0.4" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    name: "Sechseck"
  },
  custom: {
    // Default circle pin
    svg: (color) => `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="1.5"/>
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
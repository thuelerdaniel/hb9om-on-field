// Repeater mode colors, labels, and helper functions for the frontend

export const MODE_COLORS = {
  FM: "#ef4444",       // red
  Fusion: "#22c55e",   // green (C4FM)
  DMR: "#3b82f6",      // blue
  "D-STAR": "#a855f7", // purple
  "P-25": "#f97316",   // orange
  NXDN: "#14b8a6",     // teal
  M17: "#ec4899",      // pink
  EchoLink: "#6366f1", // indigo (feature, not primary)
  "WIRES-X": "#f59e0b", // amber (feature, not primary)
  AllStar: "#8b5cf6",   // violet (feature)
  IRLP: "#0ea5e9",      // sky (feature)
  Other: "#6b7280",     // gray
};

export const MODE_LABELS = {
  FM: "FM",
  Fusion: "C4FM (Fusion)",
  DMR: "DMR",
  "D-STAR": "D-STAR",
  "P-25": "P-25",
  NXDN: "NXDN",
  M17: "M17",
  EchoLink: "EchoLink",
  "WIRES-X": "WIRES-X",
  AllStar: "AllStar",
  IRLP: "IRLP",
  Other: "Weitere",
};

// All modes that can be filtered (primary modes only — not features like EchoLink/WIRES-X)
export const FILTER_MODES = ["FM", "Fusion", "DMR", "D-STAR", "P-25", "NXDN", "M17"];

export function getModeColor(primaryMode) {
  return MODE_COLORS[primaryMode] || MODE_COLORS.Other;
}

export function getModeLabel(mode) {
  return MODE_LABELS[mode] || mode;
}

// Status display helpers
export const STATUS_LABELS = {
  "on-air": { label: "On Air", color: "#22c55e", bg: "#f0fdf4" },
  "off-air": { label: "Off Air", color: "#ef4444", bg: "#fef2f2" },
  testing: { label: "Test/Reduziert", color: "#f59e0b", bg: "#fffbeb" },
  unknown: { label: "Unbekannt", color: "#6b7280", bg: "#f9fafb" },
};
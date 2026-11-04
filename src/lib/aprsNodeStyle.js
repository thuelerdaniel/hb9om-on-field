// Anzeige-Namen und Farben der APRS-/Node-Typen (gemeinsam genutzt von
// PrivateNodeLayer, Filter und APRS-Popup).

export const NODE_TYPE_LABELS = {
  repeater_node: "Digipeater / Relais",
  echolink_node: "IGate / EchoLink",
  allstar_node: "AllStar Node",
  weather_station: "Wetterstation",
  hotspot: "Hotspot / Home",
  simplex_node: "Simplex Node",
  mobile: "Mobile (diverse)",
  car: "Auto / Fahrzeug",
  bike: "Fahrrad / Moto",
  boat: "Boot / Schiff",
  aircraft: "Flugzeug / Heli",
  walker: "Fussgänger",
  other: "Sonstiges",
};

export const NODE_COLORS = {
  repeater_node: "#3b82f6",
  echolink_node: "#6366f1",
  allstar_node: "#f59e0b",
  weather_station: "#10b981",
  hotspot: "#8b5cf6",
  simplex_node: "#0ea5e9",
  mobile: "#ec4899",
  car: "#ef4444",
  bike: "#f97316",
  boat: "#06b6d4",
  aircraft: "#7c3aed",
  walker: "#84cc16",
  other: "#6b7280",
};

// BrandMeister DMR — eigene Farbwelt, damit die beiden Systeme unterscheidbar bleiben.
export const BM_COLORS = {
  repeater_node: "#14b8a6",
  hotspot: "#0891b2",
  other: "#64748b",
};
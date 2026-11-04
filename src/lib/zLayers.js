// Zentrale z-index-Skala der App (v1.0).
//
// Alles, was eine Aktion erwartet (Dialoge, Bestätigungen), muss ÜBER allen
// Karten-Elementen liegen: Leaflet-Panes, linkes Bedien-Panel, Filter-Popups,
// untere Menüleiste. Diese Datei ist die einzige Stelle, an der die Zahlen stehen.
//
// Wichtig: Leaflet-Panes gehen bis 1002 (tooltipPane), Badges/Hinweise der Karte
// bis 2200 — deshalb beginnen Dialoge bei 10000.

export const Z = {
  // Karten-Ebene
  MAP_UI: 1000,          // Filter-Trigger, Legende, Karten-Buttons
  MAP_UI_RAISED: 1005,   // Filter-Trigger über Panels
  FILTER_PANEL: 1010,    // aufgeklappte Filter-Popups
  RAIL: 1001,            // linker Bedien-Panel-Griff / Header
  BOTTOM_NAV: 1100,      // untere Menüleiste
  MAP_HINT: 2200,        // Fortschritts-/Ladehinweise der Karte

  // Aktionsebene — immer über allem Karten-Zeug
  DIALOG: 10002,         // Dialoge, die eine Aktion erwarten
  DIALOG_TOP: 10010,     // Bestätigungen über anderen Dialogen
  TOAST: 10050,          // Toasts (auch über Dialogen, damit Aktionen klickbar sind)
};
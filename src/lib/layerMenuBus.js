// Steuerung des Ebenen-Menüs von ausserhalb der Karte (v1.0).
//
// Der Ebenen-Button sitzt seit v1.0 in der unteren Menüleiste. Die Menüleiste
// existiert auf jeder Seite, das Ebenen-Menü nur auf der Karte. Damit der Button
// überall funktioniert:
//   - ist die Karte offen → Menü sofort öffnen (Listener)
//   - ist eine andere Seite offen → Anfrage merken, zur Karte wechseln,
//     die Karte holt die Anfrage beim Aufbau ab (consume)
//
// Bewusst winzig und ohne State-Manager: ein Modul-Flag + ein DOM-Event.

const PENDING_KEY = "pending";

let pending = false;
const listeners = new Set();

// Anfrage stellen — öffnet das Menü sofort, wenn die Karte schon zuhört.
export function requestLayerMenu() {
  if (listeners.size > 0) {
    listeners.forEach(fn => {
      try { fn(); } catch {}
    });
    return;
  }
  pending = true;
}

// Von der Karte beim Aufbau abholen (true = Menü bitte öffnen).
export function consumeLayerMenuRequest() {
  if (!pending) return false;
  pending = false;
  return true;
}

// Karte registriert ihren Öffnen-Handler.
export function subscribeLayerMenu(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export { PENDING_KEY };
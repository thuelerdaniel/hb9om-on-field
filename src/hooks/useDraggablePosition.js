import { useEffect, useRef } from "react";
import { clampToParent } from "@/lib/viewportClamp";

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;
const EDGE = 12;

// Gerätetyp — Position wird getrennt pro Handy / Tablet / PC gespeichert (Punkt G).
function deviceKey() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

// Das grosse Kind ist das Popup. Bei hideTrigger ist der Container nur ein
// unsichtbarer Anker — dann ist das Popup sein einziges grosses Kind.
function findPopup(container) {
  let best = null;
  for (const child of container.children) {
    if (!child.getBoundingClientRect || child.offsetHeight < 120) continue;
    if (!best || child.offsetWidth * child.offsetHeight > best.offsetWidth * best.offsetHeight) {
      best = child;
    }
  }
  return best;
}

// Zentriert das Popup im Elternbereich (Karte/Viewport) — horizontal + vertikal.
// Gibt false zurück, wenn (noch) kein Popup sichtbar ist.
function centerPopup(container) {
  const popup = findPopup(container);
  if (!popup) return false;

  const parent = container.offsetParent || document.body;
  const par = parent.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  const pr = popup.getBoundingClientRect();

  // Abstand Popup → Container (bleibt beim Verschieben erhalten)
  const dx = pr.left - cr.left;
  const dy = pr.top - cr.top;

  const w = Math.min(pr.width, par.width - EDGE * 2);
  const h = Math.min(pr.height, par.height - EDGE * 2);

  let left = par.left + (par.width - w) / 2 - dx;
  let top = par.top + (par.height - h) / 2 - dy;

  // Nie aus dem Bildschirm ragen
  left = Math.max(par.left + EDGE, Math.min(left, par.left + par.width - w - EDGE));
  top = Math.max(par.top + EDGE, Math.min(top, par.top + par.height - h - EDGE));

  container.style.left = `${Math.round(left - par.left)}px`;
  container.style.top = `${Math.round(top - par.top)}px`;
  container.style.right = "auto";
  container.style.bottom = "auto";
  container.style.transform = "none";
  return true;
}

function applyPos(container, pos) {
  container.style.left = `${pos.left}px`;
  container.style.top = `${pos.top}px`;
  container.style.right = "auto";
  container.style.bottom = "auto";
  container.style.transform = "none";
}

/**
 * Macht ein Popup/Fenster per Langdruck verschiebbar.
 *
 * Punkt G (v1.0): Ohne eigene Verschiebung öffnet jedes Popup ZENTRIERT im
 * Viewport — horizontal und vertikal. Eine vom Benutzer gewählte Position wird
 * gespeichert und beim nächsten Öffnen wiederhergestellt, getrennt pro Gerätetyp
 * (Handy / Tablet / PC). Berührt grosse Touch-Ziele, Klicks funktionieren normal.
 *
 * @param {string} storageKey - eindeutiger Schlüssel (Gerätetyp wird angehängt)
 */
export function useDraggablePosition(storageKey) {
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const longPressTimer = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const dragEnded = useRef(false);
  // true = Benutzer hat selbst verschoben → Position wird NICHT neu zentriert
  const hasCustomPos = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let device = deviceKey();
    const keyFor = (d) => `${storageKey}|${d}`;
    let key = keyFor(device);

    const save = (pos) => {
      try { localStorage.setItem(keyFor(device), JSON.stringify(pos)); } catch {}
    };
    const read = (d) => {
      try {
        const raw = localStorage.getItem(keyFor(d));
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    };

    const center = () => {
      if (centerPopup(container)) {
        const parent = container.offsetParent || document.body;
        const par = parent.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        save({ left: Math.round(cr.left - par.left), top: Math.round(cr.top - par.top) });
      }
    };

    // 1) Gespeicherte Position dieses Geräts wiederherstellen, sonst zentrieren
    const saved = read(device);
    if (saved) {
      hasCustomPos.current = true;
      applyPos(container, saved);
      requestAnimationFrame(() => {
        try { save(clampToParent(container)); } catch {}
      });
    } else {
      hasCustomPos.current = false;
      requestAnimationFrame(() => {
        if (!saved) center();
      });
    }

    // 2) Popup öffnet/schliesst → ohne eigene Position immer neu zentrieren.
    //    Wird ein Popup erst später geöffnet (isOpen), greift genau dieser Pfad.
    const observer = new MutationObserver(() => {
      if (hasCustomPos.current) return;
      requestAnimationFrame(() => { if (!hasCustomPos.current) center(); });
    });
    observer.observe(container, { childList: true });

    const onStart = (clientX, clientY) => {
      startPos.current = { x: clientX, y: clientY };
      const rect = container.getBoundingClientRect();
      offset.current = { x: clientX - rect.left, y: clientY - rect.top };
      longPressTimer.current = setTimeout(() => {
        dragging.current = true;
        container.style.zIndex = "1100";
        container.style.opacity = "0.9";
      }, LONG_PRESS_MS);
    };

    const onMove = (clientX, clientY) => {
      if (!dragging.current) return;
      const parent = container.offsetParent || document.body;
      const parentRect = parent.getBoundingClientRect();
      const maxLeft = parentRect.width - container.offsetWidth;
      const maxTop = parentRect.height - container.offsetHeight;
      const newLeft = Math.max(0, Math.min(maxLeft, clientX - parentRect.left - offset.current.x));
      const newTop = Math.max(0, Math.min(maxTop, clientY - parentRect.top - offset.current.y));
      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.transform = "none";
    };

    const onEnd = () => {
      clearTimeout(longPressTimer.current);
      if (dragging.current) {
        dragging.current = false;
        dragEnded.current = true;
        hasCustomPos.current = true;
        container.style.zIndex = "";
        container.style.opacity = "";
        setTimeout(() => { dragEnded.current = false; }, 300);
        const rect = container.getBoundingClientRect();
        const parent = container.offsetParent || document.body;
        const parentRect = parent.getBoundingClientRect();
        save({
          left: Math.round(rect.left - parentRect.left),
          top: Math.round(rect.top - parentRect.top),
        });
      }
    };

    // Touch-Eingaben
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      if (!dragging.current) {
        const dx = Math.abs(e.touches[0].clientX - startPos.current.x);
        const dy = Math.abs(e.touches[0].clientY - startPos.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) clearTimeout(longPressTimer.current);
        return;
      }
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => onEnd();

    // Maus (Desktop)
    const onMouseDown = (e) => { if (e.button !== 0) return; onStart(e.clientX, e.clientY); };
    const onMouseMove = (e) => { if (!dragging.current) return; e.preventDefault(); onMove(e.clientX, e.clientY); };
    const onMouseUp = () => onEnd();

    // Klick nach dem Ziehen unterdrücken
    const onClickCapture = (e) => {
      if (dragEnded.current) {
        e.stopPropagation();
        e.preventDefault();
        dragEnded.current = false;
      }
    };

    // Kontextmenü bei Langdruck verhindern
    const onContextMenu = (e) => {
      if (dragging.current || dragEnded.current) e.preventDefault();
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    container.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    container.addEventListener("click", onClickCapture, true);
    container.addEventListener("contextmenu", onContextMenu);

    // Grössen-/Ausrichtungswechsel: neuer Gerätetyp → dessen Position (oder Zentrum)
    const handleViewportChange = () => {
      requestAnimationFrame(() => {
        const nextDevice = deviceKey();
        if (nextDevice !== device) {
          device = nextDevice;
          key = keyFor(device);
          const restored = read(device);
          hasCustomPos.current = !!restored;
          if (restored) {
            applyPos(container, restored);
            try { save(clampToParent(container)); } catch {}
            return;
          }
        }
        if (hasCustomPos.current) {
          try { save(clampToParent(container)); } catch {}
        } else {
          center();
        }
      });
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("click", onClickCapture, true);
      container.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      observer.disconnect();
      clearTimeout(longPressTimer.current);
    };
  }, [storageKey]);

  return { containerRef };
}
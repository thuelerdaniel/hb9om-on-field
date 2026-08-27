import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";

// Verschiebbarer QSO-Loggen Button — position: fixed, draggable per Pointer-Events.
// Long-Press (500ms) startet Drag-Modus, normaler Klick öffnet das QSO-Formular.
// Position wird in LocalStorage unter "qso_btn_pos" gespeichert (x, y).
// Clamp an Viewport-Grenzen — Button darf nicht aus dem Bildschirm geschoben werden.

const STORAGE_KEY = "qso_btn_pos";
const LONG_PRESS_MS = 500;
const BUTTON_WIDTH = 140;
const BUTTON_HEIGHT = 56;

function loadPosition() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      if (typeof pos.x === "number" && typeof pos.y === "number") return pos;
    }
  } catch {}
  return null;
}

function savePosition(x, y) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {}
}

function clampToViewport(x, y) {
  const maxX = window.innerWidth - BUTTON_WIDTH;
  const maxY = window.innerHeight - BUTTON_HEIGHT;
  return {
    x: Math.max(4, Math.min(maxX, x)),
    y: Math.max(4, Math.min(maxY, y)),
  };
}

export function resetQsoButtonPosition() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function DraggableQsoButton({ onClick }) {
  const [pos, setPos] = useState(() => {
    const saved = loadPosition();
    if (saved) return clampToViewport(saved.x, saved.y);
    // Default: unten rechts
    return clampToViewport(window.innerWidth - BUTTON_WIDTH - 20, window.innerHeight - BUTTON_HEIGHT - 100);
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const longPressTimerRef = useRef(null);
  const hasMovedRef = useRef(false);

  // Position bei Viewport-Änderung neu clampen
  useEffect(() => {
    const handleResize = () => setPos(p => clampToViewport(p.x, p.y));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
    hasMovedRef.current = false;

    // Long-Press Timer starten
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      setIsDragging(true);
    }, LONG_PRESS_MS);
  }, [pos]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) {
      // Frühzeitige Bewegungserkennung — bricht Long-Press ab
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      if (dx > 5 || dy > 5) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMovedRef.current = true;

    const newX = dragStartRef.current.posX + dx;
    const newY = dragStartRef.current.posY + dy;
    setPos(clampToViewport(newX, newY));
  }, [isDragging]);

  const handlePointerUp = useCallback((e) => {
    // Long-Press Timer abbrechen
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDragging) {
      // Drag beenden — Position speichern
      savePosition(pos.x, pos.y);
      setIsDragging(false);
      setIsLongPress(false);
    } else if (!hasMovedRef.current) {
      // Normaler Klick — QSO-Formular öffnen
      onClick?.();
    }
  }, [isDragging, pos, onClick]);

  // Globale Pointer-Events während Drag
  useEffect(() => {
    if (!isDragging) return;
    const moveHandler = (e) => handlePointerMove(e);
    const upHandler = (e) => handlePointerUp(e);
    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
    window.addEventListener("pointercancel", upHandler);
    return () => {
      window.removeEventListener("pointermove", moveHandler);
      window.removeEventListener("pointerup", upHandler);
      window.removeEventListener("pointercancel", upHandler);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return (
    <button
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        // Click nur auslösen wenn kein Drag stattfand
        if (hasMovedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="fixed z-[1000] h-14 px-6 rounded-full bg-[#8cff00] text-black shadow-2xl shadow-[#8cff00]/40 flex items-center gap-2 select-none"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? "scale(1.05)" : "scale(1)",
        transition: isDragging ? "none" : "transform 0.15s, opacity 0.15s",
        cursor: isDragging ? "grabbing" : isLongPress ? "grab" : "pointer",
        touchAction: "none",
      }}
      title="Klick: QSO loggen · Lang gedrückt halten: verschieben"
    >
      <Plus className="w-6 h-6" />
      <span className="font-bold text-sm whitespace-nowrap">QSO loggen</span>
    </button>
  );
}
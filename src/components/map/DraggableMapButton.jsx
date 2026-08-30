import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { loadDevicePosition, saveDevicePosition } from "@/lib/deviceUtils";

// Generischer verschiebbarer Map-Button — v0.92: Lang-Press zum Verschieben,
// kurzer Klick löst onClick aus. Position pro Gerät gespeichert.
// Default-Position wird als { x, y } in Pixeln relativ zum Viewport angegeben.

const LONG_PRESS_MS = 500;

function clampToViewport(x, y, w, h) {
  const maxX = window.innerWidth - w;
  const maxY = window.innerHeight - h;
  return {
    x: Math.max(4, Math.min(maxX, x)),
    y: Math.max(4, Math.min(maxY, y)),
  };
}

export default function DraggableMapButton({
  storageKey,        // localStorage base key (e.g. "mapbtn_drag_mode")
  defaultPos,        // { x, y } in px — fallback if nothing saved
  size = 44,         // button width/height in px
  onClick,
  title,
  children,          // icon + optional label
  active = false,    // visual active state
  activeClass = "bg-blue-500 border-blue-600 text-white",
  inactiveClass = "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
  className = "",    // extra classes
  style = {},        // extra inline styles
}) {
  const [pos, setPos] = useState(() => {
    const saved = loadDevicePosition(storageKey, null);
    if (saved) return clampToViewport(saved.x, saved.y, size, size);
    return clampToViewport(defaultPos.x, defaultPos.y, size, size);
  });
  const [isDragging, setIsDragging] = useState(false);
  const isLongPressRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const longPressTimerRef = useRef(null);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setPos(p => clampToViewport(p.x, p.y, size, size));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    hasMovedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsDragging(true);
    }, LONG_PRESS_MS);
  }, [pos]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) {
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
    setPos(clampToViewport(dragStartRef.current.posX + dx, dragStartRef.current.posY + dy, size, size));
  }, [isDragging, size]);

  const handleButtonPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isDragging) isLongPressRef.current = false;
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isDragging) {
      saveDevicePosition(storageKey, { x: pos.x, y: pos.y });
      setIsDragging(false);
    }
  }, [isDragging, pos, storageKey]);

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

  return createPortal(
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handleButtonPointerUp}
      onClick={(e) => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isLongPressRef.current || hasMovedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          onClick?.();
        }
        isLongPressRef.current = false;
        hasMovedRef.current = false;
      }}
      className={`fixed z-[1000] flex items-center justify-center rounded-lg shadow-lg border transition-colors select-none ${active ? activeClass : inactiveClass} ${className}`}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? "scale(1.05)" : "scale(1)",
        transition: isDragging ? "none" : "transform 0.15s, opacity 0.15s",
        cursor: isDragging ? "grabbing" : "pointer",
        touchAction: "none",
        ...style,
      }}
      title={title}
    >
      {children}
    </button>,
    document.body
  );
}

export function resetDraggableMapButton(storageKey) {
  const devices = ['desktop', 'tablet', 'mobile'];
  for (const d of devices) {
    try { localStorage.removeItem(`${storageKey}_${d}`); } catch {}
  }
}
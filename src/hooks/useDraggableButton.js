// useDraggableButton — Hook für verschiebbare Buttons mit Position-Persistenz.
// Long-Press (500ms) auf Mobile zum Starten des Drag, sofort auf Desktop (Maus).
// Position wird in localStorage (sofort, pro Gerät) gespeichert.
// Click vs Drag: wenn der Button bewegt wurde, wird der Click nicht ausgelöst.

import { useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "draggableButtonPositions";

export function useDraggableButton(buttonId, defaultPosition) {
  const buttonRef = useRef(null);
  const dragState = useRef({
    dragging: false,
    moved: false,
    offset: { x: 0, y: 0 },
  });

  // Load position from localStorage
  const loadPosition = useCallback(() => {
    try {
      const positions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return positions[buttonId] || defaultPosition;
    } catch {
      return defaultPosition;
    }
  }, [buttonId, defaultPosition]);

  // Save position to localStorage
  const savePosition = useCallback((x, y) => {
    try {
      const positions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      positions[buttonId] = { x, y };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {}
  }, [buttonId]);

  // Apply position to element
  const applyPosition = useCallback((x, y) => {
    const el = buttonRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  }, []);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;

    // Restore position on mount
    const pos = loadPosition();
    if (pos) applyPosition(pos.x, pos.y);

    let dragTimeout = null;

    const onMove = (clientX, clientY) => {
      if (!dragState.current.dragging) return;
      const x = clientX - dragState.current.offset.x;
      const y = clientY - dragState.current.offset.y;
      const maxX = window.innerWidth - el.offsetWidth;
      const maxY = window.innerHeight - el.offsetHeight;
      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));
      applyPosition(clampedX, clampedY);
      dragState.current.moved = true;
    };

    const onEnd = () => {
      if (dragState.current.dragging && dragState.current.moved) {
        const rect = el.getBoundingClientRect();
        savePosition(rect.left, rect.top);
      }
      dragState.current.dragging = false;
      el.style.opacity = "1";
    };

    // Touch handlers (long-press to drag)
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      dragState.current.offset = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
      dragState.current.moved = false;
      dragTimeout = setTimeout(() => {
        dragState.current.dragging = true;
        el.style.opacity = "0.7";
        if (navigator.vibrate) navigator.vibrate(50);
      }, 500);
    };

    const handleTouchMove = (e) => {
      if (dragState.current.dragging) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      if (dragTimeout) clearTimeout(dragTimeout);
      onEnd();
    };

    // Mouse handlers (immediate drag)
    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      dragState.current.dragging = true;
      const rect = el.getBoundingClientRect();
      dragState.current.offset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      dragState.current.moved = false;
      el.style.opacity = "0.7";
    };

    const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
    const handleMouseUp = () => onEnd();

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (dragTimeout) clearTimeout(dragTimeout);
    };
  }, [buttonId, loadPosition, applyPosition, savePosition]);

  return { buttonRef, dragState };
}
import { useEffect, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;

/**
 * Makes an absolutely-positioned element draggable via long-press.
 * Normal taps/clicks still work — drag only starts after holding 500ms.
 * Position is saved to localStorage and restored on mount.
 *
 * @param {string} storageKey - unique localStorage key for this element
 * @returns {{ containerRef: React.RefObject }} attach to the outer draggable div
 */
export function useDraggablePosition(storageKey) {
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const longPressTimer = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const dragEnded = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Restore saved position
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const pos = JSON.parse(saved);
        container.style.left = `${pos.left}px`;
        container.style.top = `${pos.top}px`;
        container.style.right = "auto";
        container.style.bottom = "auto";
        container.style.transform = "none";
      }
    } catch {}

    const onStart = (clientX, clientY) => {
      startPos.current = { x: clientX, y: clientY };
      const rect = container.getBoundingClientRect();
      offset.current = { x: clientX - rect.left, y: clientY - rect.top };
      longPressTimer.current = setTimeout(() => {
        dragging.current = true;
        container.style.zIndex = "1100";
        container.style.opacity = "0.85";
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
        container.style.zIndex = "";
        container.style.opacity = "";
        setTimeout(() => { dragEnded.current = false; }, 300);
        const rect = container.getBoundingClientRect();
        const parent = container.offsetParent || document.body;
        const parentRect = parent.getBoundingClientRect();
        const pos = {
          left: Math.round(rect.left - parentRect.left),
          top: Math.round(rect.top - parentRect.top),
        };
        try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch {}
      }
    };

    // Touch handlers
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      if (!dragging.current) {
        const dx = Math.abs(e.touches[0].clientX - startPos.current.x);
        const dy = Math.abs(e.touches[0].clientY - startPos.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          clearTimeout(longPressTimer.current);
        }
        return;
      }
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => onEnd();

    // Mouse handlers (desktop)
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      onStart(e.clientX, e.clientY);
    };
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => onEnd();

    // Suppress click after drag
    const onClickCapture = (e) => {
      if (dragEnded.current) {
        e.stopPropagation();
        e.preventDefault();
        dragEnded.current = false;
      }
    };

    // Prevent context menu on long-press
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

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("click", onClickCapture, true);
      container.removeEventListener("contextmenu", onContextMenu);
      clearTimeout(longPressTimer.current);
    };
  }, [storageKey]);

  return { containerRef };
}
import { useEffect, useRef, useCallback } from "react";

/**
 * Makes an absolutely-positioned element draggable by a drag handle.
 * Returns a ref to attach to the container and a ref for the handle.
 * On drag, updates the element's left/top style. Position persists in state
 * provided by the caller (onPositionChange callback).
 *
 * Usage:
 *   const { containerRef, handleRef } = useDraggable();
 *   <div ref={containerRef} className="absolute ...">
 *     <div ref={handleRef} className="cursor-grab active:cursor-grabbing">Header</div>
 *     ...content
 *   </div>
 */
export function useDraggable(onPositionChange) {
  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const handle = handleRef.current;
    if (!container || !handle) return;

    const onStart = (clientX, clientY) => {
      dragging.current = true;
      const rect = container.getBoundingClientRect();
      offset.current = { x: clientX - rect.left, y: clientY - rect.top };
      handle.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
      if (!dragging.current) return;
      const parent = container.offsetParent || document.body;
      const parentRect = parent.getBoundingClientRect();
      const newLeft = clientX - parentRect.left - offset.current.x;
      const newTop = clientY - parentRect.top - offset.current.y;
      container.style.left = `${Math.max(0, newLeft)}px`;
      container.style.top = `${Math.max(0, newTop)}px`;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      if (onPositionChange) onPositionChange({ left: newLeft, top: newTop });
    };

    const onEnd = () => {
      dragging.current = false;
      handle.style.cursor = 'grab';
    };

    const onMouseDown = (e) => { e.preventDefault(); onStart(e.clientX, e.clientY); };
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => onEnd();

    const onTouchStart = (e) => { e.preventDefault(); onStart(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e) => onMove(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = () => onEnd();

    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    handle.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      handle.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handle.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onPositionChange]);

  return { containerRef, handleRef };
}
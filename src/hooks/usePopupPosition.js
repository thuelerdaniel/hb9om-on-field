import { useState, useRef, useCallback, useLayoutEffect } from "react";

// Hook for smart popup positioning — prevents popups from opening outside the viewport.
// PUNKT 4: When a filter button is at the top of the screen, the popup opens downward.
// When at the bottom, it opens upward. The popup is clamped to stay within the viewport.
//
// Usage:
//   const { popupRef, popupStyle, calculatePosition } = usePopupPosition();
//   // On button click:
//   calculatePosition(buttonRef.current);
//   // In JSX:
//   <div ref={popupRef} style={popupStyle}>...</div>

export function usePopupPosition(popupHeight = 400) {
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  const calculatePosition = useCallback((btnElement) => {
    if (!btnElement) return;
    const rect = btnElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const buttonCenterY = rect.top + rect.height / 2;

    // Determine if button is in the top third → open downward, else open upward
    const openDownward = buttonCenterY < viewportHeight / 3;

    let top;
    if (openDownward) {
      // Open below the button
      top = rect.bottom + 4;
      // Clamp: don't let popup extend beyond viewport bottom
      const maxTop = viewportHeight - popupHeight - 8;
      if (top > maxTop) top = maxTop;
      if (top < 8) top = 8;
    } else {
      // Open above the button
      top = rect.top - popupHeight - 4;
      // Clamp: don't let popup extend above viewport top
      if (top < 8) {
        // Not enough space above — open below instead
        top = rect.bottom + 4;
        const maxTop = viewportHeight - popupHeight - 8;
        if (top > maxTop) top = maxTop;
      }
      if (top < 8) top = 8;
    }

    // Horizontal: align with button left edge, clamp to viewport
    let left = rect.left;
    const popupWidth = 288; // w-72 = 18rem = 288px
    if (left + popupWidth > viewportWidth - 8) {
      left = viewportWidth - popupWidth - 8;
    }
    if (left < 8) left = 8;

    setPopupStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 1010,
    });
  }, [popupHeight]);

  return { popupRef, buttonRef, popupStyle, calculatePosition };
}
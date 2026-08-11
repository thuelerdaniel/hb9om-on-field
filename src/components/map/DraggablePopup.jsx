import { useEffect, useRef } from "react";
import { Popup } from "react-leaflet";
import L from "leaflet";

/**
 * Wraps react-leaflet's <Popup> and makes it draggable by its content wrapper.
 * Uses L.Draggable to add a CSS transform offset — the popup stays anchored to
 * its geographic point but can be repositioned visually to avoid covering markers.
 */
export default function DraggablePopup({ children, ...props }) {
  const popupRef = useRef(null);

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    // The popup element is created lazily when the popup opens.
    // Use Popup's 'add' event to get the DOM element.
    const onAdd = () => {
      const container = popup.getElement();
      if (!container) return;
      const handle = container.querySelector('.leaflet-popup-content-wrapper');
      if (!handle) return;

      // Add a visual drag-handle cursor
      handle.style.cursor = 'grab';

      // L.Draggable adds translate3d transforms to the container.
      const draggable = new L.Draggable(container, handle);
      draggable.enable();

      // Clean up when popup is removed
      popup._draggable = draggable;
    };

    popup.on('add', onAdd);
    // If popup is already open (element exists), wire up immediately
    if (popup.getElement()) onAdd();

    return () => {
      popup.off('add', onAdd);
      if (popup._draggable) {
        popup._draggable.disable();
        popup._draggable = null;
      }
    };
  }, []);

  return (
    <Popup ref={popupRef} {...props}>
      {children}
    </Popup>
  );
}
// viewportClamp — Shared viewport clamping with safe-area inset support.
// Used by all draggable button systems (useDraggablePosition, DraggableMapButton,
// useDraggableButton, DraggableQsoButton) to keep buttons visible at all resolutions.
//
// Safe-area insets (notch, rounded corners) are read from a sentinel element
// because env() in CSS custom properties is not reliably resolved by getComputedStyle.
// The cache is invalidated on resize/orientationchange since insets can change.

let _safeAreaCache = null;

function getSafeAreaInsets() {
  if (_safeAreaCache) return _safeAreaCache;
  if (typeof window === "undefined" || !document.body) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;" +
    "padding-top:env(safe-area-inset-top,0px);" +
    "padding-right:env(safe-area-inset-right,0px);" +
    "padding-bottom:env(safe-area-inset-bottom,0px);" +
    "padding-left:env(safe-area-inset-left,0px);" +
    "visibility:hidden;pointer-events:none;z-index:-1;";
  document.body.appendChild(el);
  const style = getComputedStyle(el);
  const parse = (v) => parseFloat(v) || 0;
  _safeAreaCache = {
    top: parse(style.paddingTop),
    right: parse(style.paddingRight),
    bottom: parse(style.paddingBottom),
    left: parse(style.paddingLeft),
  };
  document.body.removeChild(el);
  return _safeAreaCache;
}

// Invalidate cache on resize/orientation change (safe-area may change on rotate)
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => { _safeAreaCache = null; });
  window.addEventListener("orientationchange", () => { _safeAreaCache = null; });
}

// Clamp fixed-position element coordinates to visible viewport.
// x, y: left/top in viewport px; w, h: element dimensions.
// Returns { x, y } clamped to visible area with safe-area + margin.
export function clampToViewport(x, y, w, h, margin = 8) {
  const sa = getSafeAreaInsets();
  const minX = sa.left + margin;
  const minY = sa.top + margin;
  const maxX = window.innerWidth - sa.right - w - margin;
  const maxY = window.innerHeight - sa.bottom - h - margin;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

// Clamp a fixed-position element in-place to visible viewport.
// Reads element position, clamps, and writes back to style. Returns { x, y }.
export function clampElementToViewport(el, margin = 8) {
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  const clamped = clampToViewport(rect.left, rect.top, el.offsetWidth, el.offsetHeight, margin);
  el.style.left = `${clamped.x}px`;
  el.style.top = `${clamped.y}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  return clamped;
}

// Clamp an absolutely-positioned element to its offsetParent's visible bounds.
// Accounts for safe-area insets and parent offset from viewport edges.
// Reads element position, clamps, and writes back to style. Returns { left, top } in parent-relative px.
export function clampToParent(el, margin = 8) {
  if (!el) return { left: 0, top: 0 };
  const parent = el.offsetParent || document.body;
  const parentRect = parent.getBoundingClientRect();
  const sa = getSafeAreaInsets();

  // Adjust safe-area for parent offset from viewport edges
  const saLeft = Math.max(0, sa.left - parentRect.left);
  const saTop = Math.max(0, sa.top - parentRect.top);
  const saRight = Math.max(0, sa.right - (window.innerWidth - parentRect.right));
  const saBottom = Math.max(0, sa.bottom - (window.innerHeight - parentRect.bottom));

  const minX = saLeft + margin;
  const minY = saTop + margin;
  const maxX = parentRect.width - saRight - el.offsetWidth - margin;
  const maxY = parentRect.height - saBottom - el.offsetHeight - margin;

  const rect = el.getBoundingClientRect();
  const currentLeft = rect.left - parentRect.left;
  const currentTop = rect.top - parentRect.top;

  let left = currentLeft;
  let top = currentTop;
  if (left > maxX) left = maxX;
  if (top > maxY) top = maxY;
  if (left < minX) left = minX;
  if (top < minY) top = minY;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";

  return { left, top };
}
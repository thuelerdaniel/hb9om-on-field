import React, { useEffect, useRef, useMemo } from "react";
import { Polygon, Circle, useMap } from "react-leaflet";

// CoveragePolygon renders a terrain-LOS coverage polygon with a smooth
// radial gradient fill — full opacity at the repeater center, fading to
// transparent at the edges. This replaces the abrupt solid-fill border
// with a natural "auslaufen" (fade-out) effect.
//
// Uses SVG <radialGradient> injected into the Leaflet SVG overlay pane.
// The gradient is relative to the polygon's bounding box (objectBoundingBox),
// so the center of the gradient aligns with the repeater location for
// roughly symmetric coverage shapes.

let gradientCounter = 0;

function createGradient(svg, gradientId, color, maxOpacity) {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  // Remove old gradient with same ID (re-render)
  const oldGrad = defs.querySelector(`#${gradientId}`);
  if (oldGrad) oldGrad.remove();

  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("cx", "50%");
  gradient.setAttribute("cy", "50%");
  gradient.setAttribute("r", "50%");
  gradient.setAttribute("gradientUnits", "objectBoundingBox");

  const stops = [
    { offset: "0%", opacity: maxOpacity },
    { offset: "40%", opacity: maxOpacity * 0.85 },
    { offset: "75%", opacity: maxOpacity * 0.4 },
    { offset: "100%", opacity: 0 },
  ];

  for (const s of stops) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", s.offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", String(s.opacity));
    gradient.appendChild(stop);
  }

  defs.appendChild(gradient);
  return gradient;
}

export default function CoveragePolygon({ positions, color, fillOpacity = 0.15, weight = 1.5, strokeOpacity = 0.4, renderer }) {
  const polygonRef = useRef(null);
  const gradientId = useMemo(() => `coverage-grad-${++gradientCounter}`, []);

  useEffect(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;

    let cancelled = false;

    const applyGradient = (path) => {
      if (cancelled) return;
      const svg = path.closest("svg");
      if (!svg) return;

      const maxOpacity = Math.min(fillOpacity, 0.35);
      createGradient(svg, gradientId, color, maxOpacity);

      path.setAttribute("fill", `url(#${gradientId})`);
      path.setAttribute("fill-opacity", "1");
    };

    // Try to get the path immediately, then retry with rAF + timeout
    const tryApply = (attempts = 0) => {
      if (cancelled) return;
      const path = polygon.getElement?.() || polygon._path;
      if (path) {
        applyGradient(path);
      } else if (attempts < 10) {
        requestAnimationFrame(() => setTimeout(() => tryApply(attempts + 1), 20));
      }
    };

    tryApply();

    return () => {
      cancelled = true;
      // Clean up the gradient from <defs> when the component unmounts
      const path = polygon.getElement?.() || polygon._path;
      const svg = path?.closest("svg");
      const g = svg?.querySelector(`#${gradientId}`);
      if (g) g.remove();
    };
  }, [color, fillOpacity, gradientId]); // NOT positions — gradient is objectBoundingBox-relative

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
      renderer={renderer}
      pathOptions={{
        color: color,
        weight: weight,
        opacity: strokeOpacity,
        fillColor: color,
        fillOpacity: fillOpacity,
      }}
    />
  );
}

// CoverageCircle — same gradient effect for circle-based coverage (non-terrain)
export function CoverageCircle({ center, radiusKm, color, fillOpacity = 0.15, weight = 1, strokeOpacity = 0.3, renderer }) {
  const circleRef = useRef(null);
  const gradientId = useMemo(() => `coverage-grad-${++gradientCounter}`, []);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    let cancelled = false;

    const applyGradient = (path) => {
      if (cancelled) return;
      const svg = path.closest("svg");
      if (!svg) return;

      const maxOpacity = Math.min(fillOpacity, 0.35);
      createGradient(svg, gradientId, color, maxOpacity);

      path.setAttribute("fill", `url(#${gradientId})`);
      path.setAttribute("fill-opacity", "1");
    };

    const tryApply = (attempts = 0) => {
      if (cancelled) return;
      const path = circle.getElement?.() || circle._path;
      if (path) {
        applyGradient(path);
      } else if (attempts < 10) {
        requestAnimationFrame(() => setTimeout(() => tryApply(attempts + 1), 20));
      }
    };

    tryApply();

    return () => {
      cancelled = true;
      const path = circle.getElement?.() || circle._path;
      const svg = path?.closest("svg");
      const g = svg?.querySelector(`#${gradientId}`);
      if (g) g.remove();
    };
  }, [color, fillOpacity, gradientId]); // NOT center/radiusKm — gradient is objectBoundingBox-relative

  return (
    <Circle
      ref={circleRef}
      center={center}
      radius={radiusKm * 1000}
      renderer={renderer}
      pathOptions={{
        color: color,
        weight: weight,
        opacity: strokeOpacity,
        fillColor: color,
        fillOpacity: fillOpacity,
      }}
    />
  );
}
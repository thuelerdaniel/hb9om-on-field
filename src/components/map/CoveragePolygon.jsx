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

export default function CoveragePolygon({ positions, color, fillOpacity = 0.15, weight = 1.5, strokeOpacity = 0.4 }) {
  const polygonRef = useRef(null);
  const gradientId = useMemo(() => `coverage-grad-${++gradientCounter}`, []);

  useEffect(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;

    // Get the SVG path element from the Leaflet polygon
    const getPath = () => {
      const el = polygon.getElement?.() || polygon._path;
      return el;
    };

    let path = getPath();
    if (!path) {
      // Retry once after a short delay — the path may not be rendered yet
      const timer = setTimeout(() => {
        path = getPath();
        if (path) applyGradient(path);
      }, 50);
      return () => clearTimeout(timer);
    }
    applyGradient(path);

    function applyGradient(path) {
      const svg = path.closest("svg");
      if (!svg) return;

      // Find or create <defs> in the SVG container
      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svg.insertBefore(defs, svg.firstChild);
      }

      // Remove old gradient if it exists (re-render)
      const oldGrad = defs.querySelector(`#${gradientId}`);
      if (oldGrad) oldGrad.remove();

      // Create radial gradient: full color at center → transparent at edge
      const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
      gradient.setAttribute("id", gradientId);
      gradient.setAttribute("cx", "50%");
      gradient.setAttribute("cy", "50%");
      gradient.setAttribute("r", "50%");
      // Use objectBoundingBox so the gradient stretches with the polygon
      gradient.setAttribute("gradientUnits", "objectBoundingBox");

      const maxOpacity = Math.min(fillOpacity, 0.35);

      const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop1.setAttribute("offset", "0%");
      stop1.setAttribute("stop-color", color);
      stop1.setAttribute("stop-opacity", String(maxOpacity));

      const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop2.setAttribute("offset", "40%");
      stop2.setAttribute("stop-color", color);
      stop2.setAttribute("stop-opacity", String(maxOpacity * 0.85));

      const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop3.setAttribute("offset", "75%");
      stop3.setAttribute("stop-color", color);
      stop3.setAttribute("stop-opacity", String(maxOpacity * 0.4));

      const stop4 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop4.setAttribute("offset", "100%");
      stop4.setAttribute("stop-color", color);
      stop4.setAttribute("stop-opacity", "0");

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      gradient.appendChild(stop3);
      gradient.appendChild(stop4);
      defs.appendChild(gradient);

      // Apply the gradient as the fill
      path.setAttribute("fill", `url(#${gradientId})`);
      // Also set fill-opacity to 1 since the gradient handles transparency
      path.setAttribute("fill-opacity", "1");

      return () => {
        const g = defs.querySelector(`#${gradientId}`);
        if (g) g.remove();
      };
    }
  }, [color, fillOpacity, gradientId, positions]);

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
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
export function CoverageCircle({ center, radiusKm, color, fillOpacity = 0.15, weight = 1, strokeOpacity = 0.3 }) {
  const circleRef = useRef(null);
  const gradientId = useMemo(() => `coverage-grad-${++gradientCounter}`, []);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    let path = circle.getElement?.() || circle._path;
    if (!path) {
      const timer = setTimeout(() => {
        path = circle.getElement?.() || circle._path;
        if (path) applyGradient(path);
      }, 50);
      return () => clearTimeout(timer);
    }
    applyGradient(path);

    function applyGradient(path) {
      const svg = path.closest("svg");
      if (!svg) return;

      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svg.insertBefore(defs, svg.firstChild);
      }

      const oldGrad = defs.querySelector(`#${gradientId}`);
      if (oldGrad) oldGrad.remove();

      const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
      gradient.setAttribute("id", gradientId);
      gradient.setAttribute("cx", "50%");
      gradient.setAttribute("cy", "50%");
      gradient.setAttribute("r", "50%");
      gradient.setAttribute("gradientUnits", "objectBoundingBox");

      const maxOpacity = Math.min(fillOpacity, 0.35);

      const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop1.setAttribute("offset", "0%");
      stop1.setAttribute("stop-color", color);
      stop1.setAttribute("stop-opacity", String(maxOpacity));

      const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop2.setAttribute("offset", "40%");
      stop2.setAttribute("stop-color", color);
      stop2.setAttribute("stop-opacity", String(maxOpacity * 0.85));

      const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop3.setAttribute("offset", "75%");
      stop3.setAttribute("stop-color", color);
      stop3.setAttribute("stop-opacity", String(maxOpacity * 0.4));

      const stop4 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop4.setAttribute("offset", "100%");
      stop4.setAttribute("stop-color", color);
      stop4.setAttribute("stop-opacity", "0");

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      gradient.appendChild(stop3);
      gradient.appendChild(stop4);
      defs.appendChild(gradient);

      path.setAttribute("fill", `url(#${gradientId})`);
      path.setAttribute("fill-opacity", "1");

      return () => {
        const g = defs.querySelector(`#${gradientId}`);
        if (g) g.remove();
      };
    }
  }, [color, fillOpacity, gradientId, center, radiusKm]);

  return (
    <Circle
      ref={circleRef}
      center={center}
      radius={radiusKm * 1000}
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
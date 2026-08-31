// itmPropagation.js — Frontend utility for ITM (Longley-Rice) propagation calls.
// Wraps backend functions computeItmPropagation and computeItmCoverage.

import { base44 } from "@/api/base44Client";

// Point-to-point ITM propagation
export async function computeItmPropagation(params) {
  try {
    const res = await base44.functions.invoke("computeItmPropagation", params);
    return res?.data || res;
  } catch (e) {
    console.error("ITM propagation error:", e);
    return null;
  }
}

// ITM coverage polygon for a repeater
export async function computeItmCoverage(params) {
  try {
    const res = await base44.functions.invoke("computeItmCoverage", params);
    return res?.data || res;
  } catch (e) {
    console.error("ITM coverage error:", e);
    return null;
  }
}

// Quality → color
export function getQualityColor(quality) {
  switch (quality) {
    case "excellent": return "#22c55e";
    case "good": return "#3b82f6";
    case "fair": return "#eab308";
    case "marginal": return "#f97316";
    default: return "#ef4444";
  }
}

// Quality → emoji badge
export function getQualityBadge(quality) {
  switch (quality) {
    case "excellent": return "🟢";
    case "good": return "🔵";
    case "fair": return "🟡";
    case "marginal": return "🟠";
    default: return "🔴";
  }
}

// Quality → German label
export function getQualityLabel(quality) {
  switch (quality) {
    case "excellent": return "Ausgezeichnet";
    case "good": return "Gut";
    case "fair": return "Mittel";
    case "marginal": return "Grenzwertig";
    default: return "Kein Signal";
  }
}

// Quality → short German label (for badges)
export function getQualityShort(quality) {
  switch (quality) {
    case "excellent": return "Exc";
    case "good": return "Gut";
    case "fair": return "Mit";
    case "marginal": return "Grz";
    default: return "—";
  }
}
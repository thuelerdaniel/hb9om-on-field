// Device detection utility — v0.9019
// detectDeviceType: 'desktop' (>=1024px, no touch), 'tablet' (>=768px), 'mobile' (<768px)
// getDeviceKey: returns device-specific localStorage key

export function detectDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (width >= 1024 && !hasTouch) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function getDeviceKey(baseKey) {
  return `${baseKey}_${detectDeviceType()}`;
}

export function loadDevicePosition(baseKey, defaultPos) {
  try {
    const key = getDeviceKey(baseKey);
    const raw = localStorage.getItem(key);
    if (raw) {
      const pos = JSON.parse(raw);
      if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
    }
  } catch {}
  return defaultPos;
}

export function saveDevicePosition(baseKey, pos) {
  try {
    const key = getDeviceKey(baseKey);
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {}
}

// Field width defaults per device
export const DEFAULT_FIELD_WIDTHS = {
  mobile: { callsign: '100%', frequency: '100%', mode: '50%', band: '50%', rst_sent: '50%', rst_received: '50%' },
  tablet: { callsign: '50%', frequency: '25%', mode: '25%', band: '25%', rst_sent: '25%', rst_received: '25%' },
  desktop: { callsign: '30%', frequency: '15%', mode: '15%', band: '15%', rst_sent: '15%', rst_received: '15%' },
};

export function loadFieldWidth(fieldId) {
  const device = detectDeviceType();
  const key = `field_width_${fieldId}_${device}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch {}
  return DEFAULT_FIELD_WIDTHS[device]?.[fieldId] || '100%';
}

export function saveFieldWidth(fieldId, width) {
  const device = detectDeviceType();
  const key = `field_width_${fieldId}_${device}`;
  try { localStorage.setItem(key, width); } catch {}
}

export function resetDevicePositions(baseKey) {
  const devices = ['desktop', 'tablet', 'mobile'];
  for (const d of devices) {
    try { localStorage.removeItem(`${baseKey}_${d}`); } catch {}
  }
}
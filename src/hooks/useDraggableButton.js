// useDraggableButton — Hook für verschiebbare Buttons mit Position-Persistenz.
// Long-Press (500ms) auf Mobile zum Starten des Drag, sofort auf Desktop (Maus).
// Position wird gespeichert in:
//   1. localStorage (sofort, pro Gerät) — Key: draggableButtonPositions
//   2. UserHuntingSettings.draggable_button_positions (fire-and-forget, pro User)
// Beim Map-Init: lädt aus localStorage (sofort), dann aus UserHuntingSettings (async, überschreibt).
// Click vs Drag: wenn der Button bewegt wurde, wird der Click nicht ausgelöst.

import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const STORAGE_KEY = "draggableButtonPositions";

// Module-level cache for UserHuntingSettings positions (loaded once per session)
let _userSettingsPositions = null;
let _userSettingsLoading = false;
let _userSettingsLoaded = false;

async function loadUserSettingsPositions() {
  if (_userSettingsLoaded) return _userSettingsPositions;
  if (_userSettingsLoading) return null;
  _userSettingsLoading = true;
  try {
    const me = await base44.auth.me();
    if (!me) { _userSettingsLoaded = true; return null; }
    const settings = await base44.entities.UserHuntingSettings.filter({ user_id: me.id });
    if (settings.length > 0 && settings[0].draggable_button_positions) {
      _userSettingsPositions = settings[0].draggable_button_positions;
      // Merge into localStorage so all buttons get the saved positions
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const merged = { ...local, ..._userSettingsPositions };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}
    }
    _userSettingsLoaded = true;
    return _userSettingsPositions;
  } catch {
    _userSettingsLoaded = true;
    return null;
  } finally {
    _userSettingsLoading = false;
  }
}

async function saveUserSettingsPosition(buttonId, x, y) {
  try {
    const me = await base44.auth.me();
    if (!me) return;
    const settings = await base44.entities.UserHuntingSettings.filter({ user_id: me.id });
    if (settings.length > 0) {
      const existing = settings[0].draggable_button_positions || {};
      const updated = { ...existing, [buttonId]: { x, y } };
      await base44.entities.UserHuntingSettings.update(settings[0].id, {
        draggable_button_positions: updated,
      });
      _userSettingsPositions = updated;
    }
  } catch {}
}

export function useDraggableButton(buttonId, defaultPosition) {
  const buttonRef = useRef(null);
  const dragState = useRef({
    dragging: false,
    moved: false,
    offset: { x: 0, y: 0 },
  });

  const loadPosition = useCallback(() => {
    try {
      const positions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return positions[buttonId] || defaultPosition;
    } catch {
      return defaultPosition;
    }
  }, [buttonId, defaultPosition]);

  const savePosition = useCallback((x, y) => {
    // 1. localStorage (immediate, per-device)
    try {
      const positions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      positions[buttonId] = { x, y };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {}
    // 2. UserHuntingSettings (fire-and-forget, per-user, cross-device sync)
    saveUserSettingsPosition(buttonId, x, y);
  }, [buttonId]);

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

    // Restore from localStorage (immediate)
    const pos = loadPosition();
    if (pos) applyPosition(pos.x, pos.y);

    // Also load from UserHuntingSettings (async, may override localStorage)
    loadUserSettingsPositions().then((userPos) => {
      if (userPos && userPos[buttonId]) {
        applyPosition(userPos[buttonId].x, userPos[buttonId].y);
      }
    });

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
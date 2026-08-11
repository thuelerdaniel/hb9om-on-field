import React, { useState, useRef, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;

/**
 * Touch-based pull-to-refresh wrapper for mobile WebView.
 * Detects a downward drag at the top of the window scroll and calls onRefresh().
 * onRefresh should return a Promise; the spinner spins until it resolves.
 */
export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    // Only begin a pull when the page is scrolled to the very top
    if (typeof window !== "undefined" && window.scrollY > 0) {
      startYRef.current = null;
      pullingRef.current = false;
      return;
    }
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (refreshing || !pullingRef.current || startYRef.current == null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Dampen the pull so it feels like a spring
    const dampened = Math.min(MAX_PULL, delta * 0.5);
    setPullDistance(dampened);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (refreshing || !pullingRef.current) {
      pullingRef.current = false;
      startYRef.current = null;
      return;
    }
    pullingRef.current = false;
    startYRef.current = null;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } catch (e) { /* swallow — refresh errors are handled by the list */ }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [refreshing, pullDistance, onRefresh]);

  const progress = Math.min(1, pullDistance / THRESHOLD);
  const indicatorHeight = refreshing ? THRESHOLD : pullDistance;

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-out"
        style={{ height: indicatorHeight }}
      >
        {refreshing ? (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        ) : (
          <RefreshCw
            className="w-6 h-6 text-gray-400 transition-transform duration-150"
            style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
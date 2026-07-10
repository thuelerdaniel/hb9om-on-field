import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 70;
const REFRESH_HEIGHT = 40;
const MAX_PULL = 100;

/**
 * Native-like pull-to-refresh wrapper.
 * Detects pull-down when the page is scrolled to top, shows a spinning
 * loader indicator, and triggers the onRefresh callback.
 */
export default function PullToRefresh({ onRefresh, children, className }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  const containerRef = useRef(null);

  const indicatorOpacity = useTransform(pullDistance, [0, 30, PULL_THRESHOLD], [0, 0.4, 1]);
  const iconRotate = useTransform(pullDistance, [0, PULL_THRESHOLD], [-180, 0]);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    const distance = pullDistance.get();
    if (distance >= PULL_THRESHOLD) {
      setRefreshing(true);
      animate(pullDistance, REFRESH_HEIGHT, { duration: 0.2, ease: "easeOut" });
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3, ease: "easeOut" });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.3, ease: "easeOut" });
    }
  }, [pulling, refreshing, pullDistance, onRefresh]);

  // Non-passive touchmove listener to allow preventDefault during active pull
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleTouchMove = (e) => {
      if (!pulling || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        e.preventDefault();
        const damped = Math.min(delta * 0.4, MAX_PULL);
        pullDistance.set(damped);
      }
    };
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleTouchMove);
  }, [pulling, refreshing, pullDistance]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={className}
    >
      <motion.div
        style={{ height: pullDistance }}
        className="flex items-center justify-center overflow-hidden"
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : (
          <motion.div style={{ opacity: indicatorOpacity, rotate: iconRotate }}>
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </motion.div>
        )}
      </motion.div>
      {children}
    </div>
  );
}
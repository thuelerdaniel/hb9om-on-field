import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 120;
const REFRESH_HEIGHT = 50;

export default function PullToRefresh({ onRefresh, children, className }) {
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const containerRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const pullDistance = useMotionValue(0);
  const rotate = useTransform(pullDistance, [0, MAX_PULL], [0, 360]);
  const opacity = useTransform(pullDistance, [0, 30, 60], [0, 0.5, 1]);
  const scale = useTransform(pullDistance, [0, 30, PULL_THRESHOLD], [0.5, 0.75, 1]);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current || refreshing) return;
    const container = containerRef.current;
    if (!container) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0 && container.scrollTop <= 0) {
      e.preventDefault();
      const dampened = Math.min(delta * 0.5, MAX_PULL);
      pullDistance.set(dampened);
    } else if (delta <= 0) {
      pullDistance.set(0);
    }
  }, [refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current || refreshing) return;
    pullingRef.current = false;
    const currentPull = pullDistance.get();
    if (currentPull >= PULL_THRESHOLD) {
      setRefreshing(true);
      animate(pullDistance, REFRESH_HEIGHT, { duration: 0.2, ease: "easeOut" });
      try {
        await onRefreshRef.current();
      } catch (e) {
        // ignore
      } finally {
        setRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3, ease: "easeOut" });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.3, ease: "easeOut" });
    }
  }, [refreshing, pullDistance]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => container.removeEventListener("touchmove", handleTouchMove);
  }, [handleTouchMove]);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        overflowY: "auto",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <motion.div style={{ y: pullDistance }} className="relative">
        <motion.div
          style={{ opacity }}
          className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
        >
          <motion.div style={{ rotate, scale, marginTop: -45 }} className="flex items-center justify-center w-10 h-10">
            {refreshing ? (
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5 text-gray-400" />
            )}
          </motion.div>
        </motion.div>
        {children}
      </motion.div>
    </div>
  );
}
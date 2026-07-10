import { useState, useEffect } from "react";

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(() => {
    const forceOffline = typeof localStorage !== "undefined" && localStorage.getItem("hb9om_force_offline") === "true";
    return (typeof navigator === "undefined" || !navigator.onLine) || forceOffline;
  });

  useEffect(() => {
    const update = () => {
      const forceOffline = localStorage.getItem("hb9om_force_offline") === "true";
      setIsOffline(!navigator.onLine || forceOffline);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return isOffline;
}
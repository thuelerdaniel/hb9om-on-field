import React, { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";

export default function GpsControl({ onLocate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setError("Geolocation nicht unterstützt");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onLocate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Standort nicht verfügbar");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="absolute bottom-14 left-3 z-[1000]">
      <button
        onClick={handleLocate}
        disabled={loading}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors border border-gray-200 flex items-center gap-2"
        title="Auf meinen GPS-Standort zentrieren"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 text-gray-700 animate-spin" />
        ) : (
          <LocateFixed className="w-5 h-5 text-gray-700" />
        )}
      </button>
      {error && (
        <div className="absolute bottom-11 left-0 bg-white shadow-lg rounded-lg px-3 py-2 text-xs text-red-600 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
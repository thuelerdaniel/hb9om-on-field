import React from "react";
import { Shield } from "lucide-react";
import UnifiedFilterShell from "@/components/map/UnifiedFilterShell";

// WWBOTA Filter — Bunker (PUNKT 9, 10: unified filter design + all countries)
// WWBOTA reference data is stored in ReferenceData. Country extraction from code prefix.
// PUNKT 10: Shows ALL countries from reference data, not just those with live spots.
export default function WwbotaFilter({
  searchQuery,
  onSearchQueryChange,
  pointCount = 0,
  visibleCount = 0,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  leftPx = 12,
  bottomPx = 230,
}) {
  return (
    <UnifiedFilterShell
      icon={Shield}
      iconColor="text-amber-700"
      title="WWBOTA – Bunker"
      layerKey="wwbota"
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      pointCount={pointCount}
      visibleCount={visibleCount}
      points={points}
      filterCountries={filterCountries}
      onFilterCountriesChange={onFilterCountriesChange}
      accentColor="brown"
      leftPx={leftPx}
      bottomPx={bottomPx}
      extractCountryCode={(p) => p.country_code || p.code?.split(/[/ -]/)[0] || "?"}
      extractCountryName={(p) => p.country || p.country_code || "?"}
      infoText="WWBOTA (World Wide Bunkers on the Air) — Bunker und Befestigungsanlagen weltweit. Referenzdaten werden unabhängig von Live-Spots angezeigt."
    />
  );
}
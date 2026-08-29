import React from "react";
import { Castle } from "lucide-react";
import UnifiedFilterShell from "@/components/map/UnifiedFilterShell";

// WCA Filter — Burgen & Schlösser (PUNKT 11: unified filter design)
// Castle data comes from OSM/Wikidata and has country_code and country fields.
export default function WcaFilter({
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
      icon={Castle}
      iconColor="text-orange-600"
      title="WCA – Burgen & Schlösser"
      layerKey="wca"
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      pointCount={pointCount}
      visibleCount={visibleCount}
      points={points}
      filterCountries={filterCountries}
      onFilterCountriesChange={onFilterCountriesChange}
      accentColor="orange"
      leftPx={leftPx}
      bottomPx={bottomPx}
      extractCountryCode={(p) => p.country_code || p.code?.split(/[/ -]/)[0] || "?"}
      extractCountryName={(p) => p.country || p.country_code || "?"}
      infoText="WCA (World Castle Award) — Burgen, Schlösser und Festungen weltweit. Daten von OpenStreetMap und Wikidata."
    />
  );
}
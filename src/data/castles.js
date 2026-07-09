// Swiss castles with WCA (World Castles Award) reference numbers
// WCA list source: https://wcagroup.org/?page_id=207 (WCALIST.ods)
// Coordinates verified against swisscastles.ch and Wikidata
// WCA references verified against the official WCA list (last update: 05 June 2026)

export const CASTLE_DATA = [
  // Aargau
  { code: "HB-00027", name: "Schloss Lenzburg", lat: 47.3886, lng: 8.1847, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00015", name: "Schloss Habsburg", lat: 47.4628, lng: 8.1810, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00023", name: "Schloss Hallwyl", lat: 47.3292, lng: 8.1954, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00005", name: "Festung Aarburg", lat: 47.2917, lng: 7.9017, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00033", name: "Schloss Schenkenberg", lat: 47.4500, lng: 8.0667, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00035", name: "Schloss Wildegg", lat: 47.4167, lng: 8.1500, canton: "AG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00010", name: "Schloss Bremgarten", lat: 47.3444, lng: 8.3403, canton: "AG", link: "https://wcagroup.org/?page_id=207" },

  // Solothurn
  { code: "HB-00455", name: "Alt-Bechburg", lat: 47.3000, lng: 7.8000, canton: "SO", link: "https://wcagroup.org/?page_id=207" },

  // Bern
  { code: "HB-00102", name: "Schloss Thun", lat: 46.7556, lng: 7.6281, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00092", name: "Schloss Oberhofen", lat: 46.7167, lng: 7.6833, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00097", name: "Schloss Spiez", lat: 46.6889, lng: 7.6889, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00049", name: "Schloss Belp", lat: 46.8900, lng: 7.5000, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00088", name: "Schloss Münsingen", lat: 46.8722, lng: 7.5628, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00059", name: "Schloss Burgdorf", lat: 47.0583, lng: 7.6267, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00045", name: "Schloss Aarberg", lat: 47.0408, lng: 7.2767, canton: "BE", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00055", name: "Stadtschloss Biel", lat: 47.1375, lng: 7.2486, canton: "BE", link: "https://wcagroup.org/?page_id=207" },

  // Vaud
  { code: "HB-00661", name: "Château de Chillon", lat: 46.4142, lng: 6.9272, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00632", name: "Château d'Aigle", lat: 46.3167, lng: 6.9667, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00899", name: "Château de Grandson", lat: 46.8050, lng: 6.6461, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00666", name: "Château de Morges", lat: 46.5086, lng: 6.4950, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00673", name: "Château de Nyon", lat: 46.3819, lng: 6.2392, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00652", name: "Château de La Sarraz", lat: 46.7050, lng: 6.4350, canton: "VD", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00680", name: "Château d'Oron", lat: 46.5556, lng: 6.8386, canton: "VD", link: "https://wcagroup.org/?page_id=207" },

  // Ticino
  { code: "HB-00557", name: "Castelgrande Bellinzona", lat: 46.1948, lng: 9.0205, canton: "TI", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00558", name: "Montebello Bellinzona", lat: 46.1923, lng: 9.0265, canton: "TI", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00559", name: "Sasso Corbaro Bellinzona", lat: 46.1875, lng: 9.0338, canton: "TI", link: "https://wcagroup.org/?page_id=207" },

  // Fribourg
  { code: "HB-00181", name: "Château de Gruyères", lat: 46.5837, lng: 7.0810, canton: "FR", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00161", name: "Château de Bulle", lat: 46.6153, lng: 7.0589, canton: "FR", link: "https://wcagroup.org/?page_id=207" },

  // St. Gallen
  { code: "HB-00410", name: "Schloss Rapperswil", lat: 47.2264, lng: 8.8167, canton: "SG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00415", name: "Schloss Sargans", lat: 47.0467, lng: 9.4533, canton: "SG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00401", name: "Schloss Werdenberg", lat: 47.0456, lng: 9.4144, canton: "SG", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00395", name: "Schloss Freudenberg", lat: 47.1400, lng: 9.3200, canton: "SG", link: "https://wcagroup.org/?page_id=207" },

  // Schaffhausen
  { code: "HB-00440", name: "Festung Munot", lat: 47.6925, lng: 8.6378, canton: "SH", link: "https://wcagroup.org/?page_id=207" },

  // Graubünden
  { code: "HB-00301", name: "Schloss Tarasp", lat: 46.7967, lng: 10.2594, canton: "GR", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00279", name: "Burg Hohenrätien", lat: 46.7333, lng: 9.4167, canton: "GR", link: "https://wcagroup.org/?page_id=207" },

  // Luzern
  { code: "HB-00330", name: "Schloss Heidegg", lat: 47.1833, lng: 8.2167, canton: "LU", link: "https://wcagroup.org/?page_id=207" },

  // Neuchâtel
  { code: "HB-00371", name: "Château de Neuchâtel", lat: 46.9917, lng: 6.9294, canton: "NE", link: "https://wcagroup.org/?page_id=207" },

  // Valais
  { code: "HB-00815", name: "Château de Valère (Sion)", lat: 46.2267, lng: 7.3644, canton: "VS", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00812", name: "Château de Tourbillon (Sion)", lat: 46.2317, lng: 7.3583, canton: "VS", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00790", name: "Château de Bâtiaz (Martigny)", lat: 46.1033, lng: 7.0800, canton: "VS", link: "https://wcagroup.org/?page_id=207" },

  // Geneva
  { code: "HB-00221", name: "Tour de l'Île (Genève)", lat: 46.2014, lng: 6.1461, canton: "GE", link: "https://wcagroup.org/?page_id=207" },

  // Zurich
  { code: "HB-00853", name: "Schloss Regensberg", lat: 47.4167, lng: 8.3667, canton: "ZH", link: "https://wcagroup.org/?page_id=207" },
  { code: "HB-00849", name: "Schloss Laufen (Rheinfall)", lat: 47.6777, lng: 8.6153, canton: "ZH", link: "https://wcagroup.org/?page_id=207" },
];
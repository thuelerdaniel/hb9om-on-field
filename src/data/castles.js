// Swiss castles verified against swisscastles.ch and Wikimedia CH Burgen-Dossier
// Sources: http://www.swisscastles.ch/liste.html, https://meta.wikimedia.org/wiki/Wikimedia_CH/Burgen-Dossier
// Castle map: https://castle-map.infs.ch/

export const CASTLE_DATA = [
  // Aargau
  { code: "HB-00001", name: "Schloss Lenzburg", lat: 47.3886, lng: 8.1847, canton: "AG", link: "http://www.swisscastles.ch/Aargau/lenzburg.html" },
  { code: "HB-00002", name: "Schloss Habsburg", lat: 47.4628, lng: 8.1810, canton: "AG", link: "http://www.swisscastles.ch/Aargau/habsburg.html" },
  { code: "HB-00003", name: "Schloss Hallwyl", lat: 47.3292, lng: 8.1954, canton: "AG", link: "http://www.swisscastles.ch/Aargau/hallwyl.html" },
  { code: "HB-00004", name: "Festung Aarburg", lat: 47.2917, lng: 7.9017, canton: "AG", link: "http://www.swisscastles.ch/Aargau/aarburg.html" },
  { code: "HB-00005", name: "Schloss Wildenstein (Veltheim)", lat: 47.4667, lng: 8.1167, canton: "AG", link: "http://www.swisscastles.ch/Aargau/wildenstein.html" },
  { code: "HB-00006", name: "Schloss Schenkenberg", lat: 47.4500, lng: 8.0667, canton: "AG", link: "http://www.swisscastles.ch/Aargau/schenkenberg.html" },
  { code: "HB-00007", name: "Burgruine Stein", lat: 47.6333, lng: 8.2667, canton: "AG", link: "http://www.swisscastles.ch/Aargau/stein.html" },
  { code: "HB-00008", name: "Schloss Wildegg", lat: 47.4167, lng: 8.1500, canton: "AG", link: "http://www.swisscastles.ch/Aargau/wildegg.html" },
  { code: "HB-00009", name: "Schloss Bremgarten", lat: 47.3444, lng: 8.3403, canton: "AG", link: "http://www.swisscastles.ch/Aargau/bremgarten.html" },
  { code: "HB-00010", name: "Alt-Bechburg", lat: 47.3000, lng: 7.8000, canton: "SO", link: "http://www.swisscastles.ch/Solothurn/altbechburg.html" },

  // Bern
  { code: "HB-00020", name: "Schloss Thun", lat: 46.7556, lng: 7.6281, canton: "BE", link: "http://www.swisscastles.ch/Bern/thun.html" },
  { code: "HB-00021", name: "Schloss Oberhofen", lat: 46.7167, lng: 7.6833, canton: "BE", link: "http://www.swisscastles.ch/Bern/oberhofen.html" },
  { code: "HB-00022", name: "Schloss Spiez", lat: 46.6889, lng: 7.6889, canton: "BE", link: "http://www.swisscastles.ch/Bern/spiez.html" },
  { code: "HB-00023", name: "Schloss Hünegg", lat: 46.6767, lng: 7.6742, canton: "BE", link: "http://www.swisscastles.ch/Bern/huenegg.html" },
  { code: "HB-00024", name: "Schloss Belp", lat: 46.8900, lng: 7.5000, canton: "BE", link: "http://www.swisscastles.ch/Bern/belp.html" },
  { code: "HB-00025", name: "Schloss Münsingen", lat: 46.8722, lng: 7.5628, canton: "BE", link: "http://www.swisscastles.ch/Bern/muensingen.html" },
  { code: "HB-00026", name: "Schloss Burgdorf", lat: 47.0583, lng: 7.6267, canton: "BE", link: "http://www.swisscastles.ch/Bern/burgdorf.html" },
  { code: "HB-00027", name: "Schloss Aarberg", lat: 47.0408, lng: 7.2767, canton: "BE", link: "http://www.swisscastles.ch/Bern/aarberg.html" },
  { code: "HB-00028", name: "Stadtschloss Biel", lat: 47.1375, lng: 7.2486, canton: "BE", link: "http://www.swisscastles.ch/Bern/biel.html" },

  // Vaud
  { code: "HB-00030", name: "Château de Chillon", lat: 46.4142, lng: 6.9272, canton: "VD", link: "http://www.swisscastles.ch/Vaud/chillon/default.htm" },
  { code: "HB-00031", name: "Château d'Aigle", lat: 46.3167, lng: 6.9667, canton: "VD", link: "http://www.swisscastles.ch/Vaud/aigle/default.htm" },
  { code: "HB-00032", name: "Château de Grandson", lat: 46.8050, lng: 6.6461, canton: "VD", link: "http://www.swisscastles.ch/Vaud/grandson.html" },
  { code: "HB-00033", name: "Château de Morges", lat: 46.5086, lng: 6.4950, canton: "VD", link: "http://www.swisscastles.ch/Vaud/morges.html" },
  { code: "HB-00034", name: "Château de Nyon", lat: 46.3819, lng: 6.2392, canton: "VD", link: "http://www.swisscastles.ch/Vaud/nyon.html" },
  { code: "HB-00035", name: "Château de La Sarraz", lat: 46.7050, lng: 6.4350, canton: "VD", link: "http://www.swisscastles.ch/Vaud/sarraz.html" },
  { code: "HB-00036", name: "Château d'Oron", lat: 46.5556, lng: 6.8386, canton: "VD", link: "http://www.swisscastles.ch/Vaud/oron.html" },
  { code: "HB-00037", name: "Château de Penthaz", lat: 46.6000, lng: 6.5667, canton: "VD", link: "http://www.swisscastles.ch/Vaud/chateau/penthaz.html" },

  // Ticino
  { code: "HB-00040", name: "Castelgrande Bellinzona", lat: 46.1948, lng: 9.0205, canton: "TI", link: "http://www.swisscastles.ch/Tessin/bellinzonacastelgrande.html" },
  { code: "HB-00041", name: "Montebello Bellinzona", lat: 46.1923, lng: 9.0265, canton: "TI", link: "http://www.swisscastles.ch/Tessin/bellinzonamontebello.html" },
  { code: "HB-00042", name: "Sasso Corbaro Bellinzona", lat: 46.1875, lng: 9.0338, canton: "TI", link: "http://www.swisscastles.ch/Tessin/bellinzonasassocorbaro.html" },

  // Fribourg
  { code: "HB-00050", name: "Château de Gruyères", lat: 46.5837, lng: 7.0810, canton: "FR", link: "http://www.swisscastles.ch/Fribourg/gruyeres.html" },
  { code: "HB-00051", name: "Château de Bulle", lat: 46.6153, lng: 7.0589, canton: "FR", link: "http://www.swisscastles.ch/Fribourg/bulle.html" },
  { code: "HB-00052", name: "Château de Châtonneyre", lat: 46.7000, lng: 6.8667, canton: "FR", link: "http://www.swisscastles.ch/Fribourg/chatonneyre.html" },

  // Zurich
  { code: "HB-00060", name: "Schloss Kyburg", lat: 47.4567, lng: 8.7442, canton: "ZH", link: "http://www.swisscastles.ch/Zurich/schloss/kyburg.html" },
  { code: "HB-00061", name: "Schloss Rapperswil", lat: 47.2264, lng: 8.8167, canton: "ZH", link: "http://www.swisscastles.ch/Zurich/schloss/rapperswil.html" },
  { code: "HB-00062", name: "Schloss Regensberg", lat: 47.4167, lng: 8.3667, canton: "ZH", link: "http://www.swisscastles.ch/Zurich/schloss/regensberg.html" },
  { code: "HB-00063", name: "Schloss Laufen (Rheinfall)", lat: 47.6777, lng: 8.6153, canton: "ZH", link: "http://www.swisscastles.ch/Zurich/schloss/laufen.html" },

  // St. Gallen
  { code: "HB-00070", name: "Schloss Sargans", lat: 47.0467, lng: 9.4533, canton: "SG", link: "http://www.swisscastles.ch/StGallen/sargans.html" },
  { code: "HB-00071", name: "Schloss Werdenberg", lat: 47.0456, lng: 9.4144, canton: "SG", link: "http://www.swisscastles.ch/StGallen/werdenberg.html" },
  { code: "HB-00072", name: "Schloss Freudenberg", lat: 47.1400, lng: 9.3200, canton: "SG", link: "http://www.swisscastles.ch/StGallen/freudenberg.html" },

  // Schaffhausen
  { code: "HB-00080", name: "Festung Munot", lat: 47.6925, lng: 8.6378, canton: "SH", link: "http://www.swisscastles.ch/Schaffhausen/munot.html" },

  // Graubünden
  { code: "HB-00090", name: "Schloss Tarasp", lat: 46.7967, lng: 10.2594, canton: "GR", link: "http://www.swisscastles.ch/Graubuenden/tarasp.html" },
  { code: "HB-00091", name: "Burg Frauenberg (Domleschg)", lat: 46.7167, lng: 9.4333, canton: "GR", link: "http://www.swisscastles.ch/Graubuenden/frauenberg.html" },
  { code: "HB-00092", name: "Burg Hohenrätien", lat: 46.7333, lng: 9.4167, canton: "GR", link: "http://www.swisscastles.ch/Graubuenden/hohenraetien.html" },

  // Luzern
  { code: "HB-00100", name: "Schloss Heidegg", lat: 47.1833, lng: 8.2167, canton: "LU", link: "http://www.swisscastles.ch/Luzern/heidegg.html" },

  // Solothurn
  { code: "HB-00110", name: "Schloss Waldegg", lat: 47.2000, lng: 7.5167, canton: "SO", link: "http://www.swisscastles.ch/Solothurn/waldegg.html" },

  // Neuchâtel
  { code: "HB-00120", name: "Château de Neuchâtel", lat: 46.9917, lng: 6.9294, canton: "NE", link: "http://www.swisscastles.ch/Neuchatel/neuchatel.html" },

  // Valais
  { code: "HB-00130", name: "Château de Valère (Sion)", lat: 46.2267, lng: 7.3644, canton: "VS", link: "http://www.swisscastles.ch/valais/chateau/valere.html" },
  { code: "HB-00131", name: "Château de Tourbillon (Sion)", lat: 46.2317, lng: 7.3583, canton: "VS", link: "http://www.swisscastles.ch/valais/chateau/tourbillon.html" },
  { code: "HB-00132", name: "Château de Bâtiaz (Martigny)", lat: 46.1033, lng: 7.0800, canton: "VS", link: "http://www.swisscastles.ch/valais/chateau/martigny.html" },

  // Geneva
  { code: "HB-00140", name: "Tour de l'Île (Genève)", lat: 46.2014, lng: 6.1461, canton: "GE", link: "http://www.swisscastles.ch/Geneve/tourile.html" },
];
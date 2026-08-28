// Callsign-Parser — extrahiert Base, Prefix und Suffix aus einem Full-Callsign.
// Fix 10: QRZ-Abfrage mit Prefix/Suffix korrekt handhaben.
//
// Beispiele:
//   "9A/HB9ABC/P"  → { base: "HB9ABC", prefix: "9A",  suffix: "P"  }
//   "I/OK4SU/P"    → { base: "OK4SU",  prefix: "I",   suffix: "P"  }
//   "DL/ON6ZQ/P"   → { base: "ON6ZQ",  prefix: "DL",  suffix: "P"  }
//   "HB9CDH/P"     → { base: "HB9CDH", prefix: "",    suffix: "P"  }
//   "HB9ABC"       → { base: "HB9ABC", prefix: "",    suffix: ""   }

// Bekannte Suffixe (keine Prefixe!)
const SUFFIX_PATTERN = /^(P|M|MM|QRP|A|AM|PORTABLE|MOBILE|MARITIME|MARITIMEMOBILE)$/i;

export function parseCallsign(fullCall) {
  if (!fullCall || typeof fullCall !== 'string') {
    return { base: '', prefix: '', suffix: '' };
  }

  let call = fullCall.trim().toUpperCase();
  let suffix = '';
  let prefix = '';

  // Suffix extrahieren (letztes / )
  const lastSlash = call.lastIndexOf('/');
  if (lastSlash > 0) {
    const afterSlash = call.substring(lastSlash + 1);
    // Suffix-Muster: P, M, MM, QRP, A, AM, etc. (1-3 Zeichen, kein Land-Präfix)
    if (SUFFIX_PATTERN.test(afterSlash) || (afterSlash.length <= 3 && !afterSlash.match(/^[A-Z]{1,2}\d/))) {
      suffix = afterSlash;
      call = call.substring(0, lastSlash);
    }
  }

  // Prefix extrahieren (erstes / in verbleibendem Call)
  const firstSlash = call.indexOf('/');
  if (firstSlash > 0) {
    prefix = call.substring(0, firstSlash);
    call = call.substring(firstSlash + 1);
  }

  // Base-Callsign bereinigen (sollte nur alphanumerisch sein)
  const base = call.replace(/[^A-Z0-9]/g, '');

  return { base, prefix, suffix };
}

// Full-Callsign aus Base, Prefix und Suffix zusammenbauen
export function buildFullCallsign(base, prefix, suffix) {
  let full = '';
  if (prefix) full += prefix + '/';
  full += base;
  if (suffix) full += '/' + suffix;
  return full;
}
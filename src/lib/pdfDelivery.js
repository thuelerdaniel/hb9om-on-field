// Delivering a generated PDF file to the user.
//
// Why this exists: the PDF is built in chunks so the map stays responsive — the file
// therefore only exists a while AFTER the tap on the export button. By then the browser's
// "user gesture" is gone, and some browsers then refuse or silently swallow an automatic
// download. Known cases: Safari/iOS, in-app browsers/WebViews, and iOS apps added to the
// Home Screen (standalone display mode).
//
// So the delivery has two stages:
//   1. one automatic attempt right after generation — the classic a[download] anchor,
//      where such a download is known to work;
//   2. explicit paths that run on a FRESH user gesture from the buttons in the toast —
//      save/share through the system sheet, or open the file in a new tab (the PDF
//      viewer of Safari/Android offers save/share there), or simply download again.

// iPhone / iPod, and iPadOS 13+ which reports itself as a Mac (detected via touch support).
export function isIosLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

// App started from the Home Screen (Add to Home Screen) / installed PWA.
export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  try {
    const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches === true;
    return standalone || window.navigator?.standalone === true;
  } catch {
    return false;
  }
}

// Environments where an automatic anchor download is unreliable (iOS, standalone apps).
export function downloadUnreliable() {
  return isIosLike() || isStandalonePwa();
}

export function pdfFileFromBlob(blob, filename) {
  try {
    return new File([blob], filename, { type: "application/pdf" });
  } catch {
    return null;
  }
}

export function canSharePdf(file) {
  try {
    return !!file && typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// Classic download through a temporary a[download] element.
export function downloadPdfBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Keep the object URL alive for a while — revoking too early aborts the download.
    window.setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
    return true;
  } catch {
    return false;
  }
}

// Open the file in a new tab — iOS Safari / Android show the PDF viewer, which offers
// share and save. Must be called from a user gesture.
export function openPdfInTab(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    window.setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
    return !!win;
  } catch {
    return false;
  }
}

// System share sheet with the PDF file (save to Files, send, print, …).
// Returns "shared" | "cancelled" | "unsupported" | "failed".
export async function sharePdfBlob(file, filename) {
  if (!file || typeof navigator === "undefined" || typeof navigator.share !== "function") return "unsupported";
  try {
    await navigator.share({ files: [file], title: filename });
    return "shared";
  } catch (err) {
    if (err && err.name === "AbortError") return "cancelled";
    return "failed";
  }
}

// Stage 1 — automatic attempt right after the PDF is built.
// "deferred" means: this environment swallows such downloads, the toast paths take over.
export function attemptAutomaticDownload(blob, filename) {
  if (downloadUnreliable()) return "deferred";
  return downloadPdfBlob(blob, filename) ? "download" : "deferred";
}

// Stage 2 — runs on the user's own gesture (button in the toast). Every path, in order:
// share sheet → new tab (unreliable-download environments) → plain download.
// Returns "shared" | "cancelled" | "open" | "download" | "failed".
export async function savePdfOnGesture(blob, filename) {
  const file = pdfFileFromBlob(blob, filename);

  if (canSharePdf(file)) {
    const shared = await sharePdfBlob(file, filename);
    if (shared === "shared") return "shared";
    if (shared === "cancelled") return "cancelled";
  }

  if (downloadUnreliable()) {
    return openPdfInTab(blob, filename) ? "open" : "failed";
  }

  return downloadPdfBlob(blob, filename) ? "download" : "failed";
}
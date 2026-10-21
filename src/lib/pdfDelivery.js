// Delivering a generated PDF file to the user.
//
// Why this exists: the PDF list is built in chunks so the map stays responsive — the file
// therefore only exists a while AFTER the tap on the export button. By then the browser's
// "user gesture" is gone, and an automatic download started outside a gesture is blocked or
// silently swallowed by several browsers (Safari/iOS, in-app browsers/WebViews, apps added
// to the home screen).
//
// A locally created blob: URL cannot fix that: blob URLs are exactly what those browsers
// refuse to download or open. So the finished file is handed to the backend, which stores it
// and returns a real https URL. Real URLs are opened, saved and shared by every browser,
// WebView and home-screen app — the buttons in the toast are therefore plain links on that
// URL and need no script at all.

import { base44 } from "@/api/base44Client";

// Blob → base64, in chunks (large lists must not blow the call stack).
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Stores the PDF and returns its https URL. Throws with a readable reason on failure.
export async function uploadPdfBlob(blob, filename) {
  const base64data = await blobToBase64(blob);
  const response = await base44.functions.invoke("uploadGeneratedPdf", { filename, base64data });
  const data = response?.data || {};
  if (!data.file_url) {
    throw new Error(data.error || "Der Datei-Speicher hat keine URL zurückgegeben.");
  }
  return data.file_url;
}
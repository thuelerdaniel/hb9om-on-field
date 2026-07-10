import { generateHelpPdf } from "@/lib/generateHelpPdf";
import { ADMIN_SECTIONS } from "@/lib/helpPdfAdminContent";

export async function generateAdminHelpPdf() {
  return generateHelpPdf({
    sections: ADMIN_SECTIONS,
    title: "Admin-Anleitung",
    subtitle: "Verwaltung und Administration der HB9OM On Field App",
    coverLabel: "ADMIN-ANLEITUNG",
    headerTitle: "Admin-Anleitung",
    setupChecklist: null,
    isAdmin: true,
    filename: "HB9OM_On_Field_Admin.pdf"
  });
}
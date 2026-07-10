import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-sm font-bold text-gray-900">Datenschutzerklärung</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Übersicht</h2>
          <p>
            Diese Datenschutzerklärung beschreibt, wie der Club HB9OM («wir») Ihre Daten erfasst, verwendet und schützt,
            wenn Sie die App «HB9OM On Field» nutzen. Die App dient Amateurfunkern als Referenzkarte und QSO-Logbuch.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">2. Welche Daten wir erfassen</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Kontodaten:</strong> E-Mail-Adresse und Passwort (verschlüsselt) bei der Registrierung.</li>
            <li><strong>QSO-Logbuchdaten:</strong> Von Ihnen erfasste Funkverbindungen (Rufzeichen, Datum, Frequenz, etc.).</li>
            <li><strong>Standortdaten:</strong> GPS-Position wird nur lokal auf Ihrem Gerät verarbeitet und nicht an uns übertragen, ausser Sie reichen eine Marker-Korrektur ein.</li>
            <li><strong>QRZ.com-Zugangsdaten:</strong> Wenn Sie die QRZ.com-Abfrage nutzen, werden Ihre QRZ-Zugangsdaten verschlüsselt gespeichert.</li>
            <li><strong>Änderungsanträge & Funktionsvorschläge:</strong> Von Ihnen eingereichte Anträge und Kommentare.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">3. Wie wir Ihre Daten verwenden</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bereitstellung und Betrieb der App-Funktionen (Karte, Logbuch, Statistik).</li>
            <li>Synchronisation Ihrer QSO-Daten über Geräte hinweg.</li>
            <li>Abfrage von Operator-Daten über QRZ.com (nur mit Ihren Zugangsdaten).</li>
            <li>Benachrichtigung von Administratoren bei neuen Registrierungen.</li>
            <li>Prüfung und Bearbeitung Ihrer Änderungsanträge und Funktionsvorschläge.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">4. Datenweitergabe an Dritte</h2>
          <p>
            Wir geben Ihre Daten nicht an Dritte weiter, ausser:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>QRZ.com-Abfragen werden direkt von Ihrem Gerät an QRZ.com gesendet.</li>
            <li>Referenzdaten werden von öffentlichen Quellen (SOTA, POTA, HBFF, etc.) geladen.</li>
            <li>Bei Cloud-Backups (WebDAV, Google Drive, OneDrive) werden Daten an den von Ihnen gewählten Anbieter übertragen.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">5. Datenspeicherung</h2>
          <p>
            Ihre QSO-Logbuchdaten werden lokal auf Ihrem Gerät gespeichert und zusätzlich mit dem Server synchronisiert.
            Sie können jederzeit ein Backup erstellen und Ihr Konto inklusive aller Daten löschen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">6. Ihre Rechte</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Auskunft:</strong> Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen.</li>
            <li><strong>Löschung:</strong> Sie können Ihr Konto und alle Daten über die Einstellungen löschen.</li>
            <li><strong>Datenexport:</strong> Sie können Ihre QSO-Daten als ADIF-Datei oder JSON-Backup exportieren.</li>
            <li><strong>Widerspruch:</strong> Sie können der Datenverarbeitung jederzeit widersprechen.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">7. Sicherheit</h2>
          <p>
            Wir ergreifen angemessene technische und organisatorische Massnahmen, um Ihre Daten zu schützen.
            Passwörter werden verschlüsselt gespeichert. Die Datenübertragung erfolgt über HTTPS.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">8. Kinder und Jugendliche</h2>
          <p>
            Die App richtet sich an lizenzierte Funkamateure. Personen unter 16 Jahren sollten die App nicht ohne
            Zustimmung der Erziehungsberechtigten nutzen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">9. Änderungen</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen. Die aktuelle Version ist immer in der App abrufbar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">10. Kontakt</h2>
          <p>
            Bei Fragen zum Datenschutz wenden Sie sich an:{" "}
            <a href="mailto:hb9om@hb9om.ch" className="text-blue-600 font-medium hover:underline">hb9om@hb9om.ch</a>
          </p>
        </section>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
          Stand: Juli 2026 · HB9OM On Field v0.7
        </p>
      </div>

      <BottomNavigation />
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Download, FileText, Smartphone, Loader2, AlertCircle, Archive } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

// Build the download URL for a DownloadItem.
// APK files are served via the downloadApk backend function which sets the
// correct Content-Type (application/vnd.android.package-archive) so Android
// browsers can install the file directly. Other types use the stored file_url.
function getDownloadUrl(item) {
  if (item.type === "apk" && item.id) {
    return `/api/apps/${appParams.appId}/functions/downloadApk?id=${item.id}`;
  }
  return item.file_url;
}

// Download-Bereich für die Hilfe-Seite.
// Zeigt alle aktiven DownloadItems (PDFs + APKs) sortiert nach upload_date (neueste zuerst).

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

export default function DownloadSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const list = await base44.entities.DownloadItem.list("-upload_date", 100);
        const active = (list || []).filter(d => d.is_active !== false);
        setItems(active);
      } catch {} finally { setLoading(false); }
    };
    fetchDownloads();
  }, []);

  const pdfs = items.filter(i => i.type === "pdf");
  const apks = items.filter(i => i.type === "apk");
  const zips = items.filter(i => i.type === "zip");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Downloads werden geladen…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* APK Downloads */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Smartphone className="w-4 h-4 text-[#22c55e]" /> Android App (APK)
        </h3>
        {apks.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-2 bg-muted/50 rounded-lg border border-border">
            Aktuell keine APK-Version verfügbar. Admins können eine APK im Admin-Bereich hochladen.
          </div>
        ) : (
          <div className="space-y-2">
            {apks.map(item => (
              <DownloadCard key={item.id} item={item} icon={Smartphone} color="#22c55e" />
            ))}
          </div>
        )}
      </div>

      {/* ZIP Downloads */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Archive className="w-4 h-4 text-[#f59e0b]" /> Archive (ZIP)
        </h3>
        {zips.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-2 bg-muted/50 rounded-lg border border-border">
            Keine ZIP-Dateien verfügbar.
          </div>
        ) : (
          <div className="space-y-2">
            {zips.map(item => (
              <DownloadCard key={item.id} item={item} icon={Archive} color="#f59e0b" />
            ))}
          </div>
        )}
      </div>

      {/* PDF Downloads */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <FileText className="w-4 h-4 text-[#00e5ff]" /> Dokumente (PDF)
        </h3>
        {pdfs.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-2 bg-muted/50 rounded-lg border border-border">
            Keine Dokumente verfügbar.
          </div>
        ) : (
          <div className="space-y-2">
            {pdfs.map(item => (
              <DownloadCard key={item.id} item={item} icon={FileText} color="#00e5ff" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadCard({ item, icon: Icon, color }) {
  return (
    <a
      href={getDownloadUrl(item)}
      download
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
          {item.version && <span className="font-mono">{item.version}</span>}
          <span>{formatSize(item.file_size)}</span>
          <span>·</span>
          <span>{formatDate(item.upload_date)}</span>
        </div>
        {item.description && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.description}</div>
        )}
        {item.type === "apk" && (
          <div className="text-[9px] text-amber-600 mt-0.5">Android App — Installation aus unbekannten Quellen erlauben</div>
        )}
        {item.type === "zip" && (
          <div className="text-[9px] text-orange-600 mt-0.5">ZIP-Datei — nach Download entpacken</div>
        )}
      </div>
      <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
    </a>
  );
}
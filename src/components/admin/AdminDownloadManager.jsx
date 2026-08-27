import React, { useState, useEffect, useCallback } from "react";
import { Upload, Trash2, ToggleLeft, ToggleRight, Loader2, FileText, Smartphone, Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Admin Download Manager — Upload, Liste, Aktivieren/Deaktivieren, Löschen von DownloadItems.
// Nur für Admins sichtbar (wird im AdminPanel gerendert).

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("de-CH"); } catch { return "—"; }
}

export default function AdminDownloadManager() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "pdf", version: "", description: "", is_active: true });
  const [file, setFile] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      const list = await base44.entities.DownloadItem.list("-upload_date", 100);
      setItems(list || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleUpload = async () => {
    if (!file || !form.name) {
      toast({ title: "Datei und Name erforderlich", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // 1. Datei hochladen
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url;
      if (!fileUrl) throw new Error("Upload fehlgeschlagen");

      // 2. User-Info für uploaded_by
      let uploadedBy = "Admin";
      try {
        const me = await base44.auth.me();
        uploadedBy = me?.full_name || me?.email || "Admin";
      } catch {}

      // 3. DownloadItem erstellen
      await base44.entities.DownloadItem.create({
        name: form.name,
        type: form.type,
        file_url: fileUrl,
        file_size: file.size,
        version: form.version || undefined,
        description: form.description || undefined,
        upload_date: new Date().toISOString(),
        uploaded_by: uploadedBy,
        is_active: form.is_active,
      });

      // 4. Falls APK: alte APK-Versionen deaktivieren?
      if (form.type === "apk") {
        const oldApks = items.filter(i => i.type === "apk" && i.id !== undefined);
        if (oldApks.length > 0) {
          const doDeactivate = confirm("Alte APK-Version deaktivieren? (Empfohlen: nur eine aktive APK)");
          if (doDeactivate) {
            for (const old of oldApks) {
              if (old.is_active !== false) {
                await base44.entities.DownloadItem.update(old.id, { is_active: false });
              }
            }
          }
        }
      }

      toast({ title: "Upload erfolgreich", description: `${form.name} wurde hochgeladen` });
      setForm({ name: "", type: "pdf", version: "", description: "", is_active: true });
      setFile(null);
      setShowForm(false);
      fetchItems();
    } catch (e) {
      toast({ title: "Upload fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleToggle = async (item) => {
    try {
      await base44.entities.DownloadItem.update(item.id, { is_active: !item.is_active });
      toast({ title: item.is_active ? "Deaktiviert" : "Aktiviert", description: item.name });
      fetchItems();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`"${item.name}" wirklich löschen? Die Datei bleibt gespeichert.`)) return;
    try {
      await base44.entities.DownloadItem.delete(item.id);
      toast({ title: "Gelöscht", description: item.name });
      fetchItems();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-[#00e5ff]" /> Downloads verwalten
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#00e5ff] text-black rounded-lg font-medium hover:bg-[#00b8d4] transition-colors"
        >
          {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showForm ? "Abbrechen" : "Neuer Upload"}
        </button>
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Datei (PDF oder APK)</label>
            {file && (
              <div className="mt-1 mb-1 text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="font-mono truncate">{file.name}</span>
                <span>·</span>
                <span>{formatSize(file.size)}</span>
                {file.size > 50 * 1024 * 1024 && <span className="text-orange-500 font-medium">⚠ Groß</span>}
              </div>
            )}
            <input
              type="file"
              accept=".pdf,.apk,application/vnd.android.package-archive,application/pdf"
              onChange={e => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) {
                  const isApk = f.name.toLowerCase().endsWith(".apk") || f.type === "application/vnd.android.package-archive";
                  setForm(prev => ({ ...prev, type: isApk ? "apk" : "pdf", name: prev.name || f.name.replace(/\.[^.]+$/, "") }));
                }
              }}
              className="w-full text-xs mt-1 p-1.5 border border-border rounded-lg bg-background"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. HB9OM Hilfe PDF"
                className="w-full text-xs mt-1 p-1.5 border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Typ</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full text-xs mt-1 p-1.5 border border-border rounded-lg bg-background"
              >
                <option value="pdf">PDF</option>
                <option value="apk">APK</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Version (optional)</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                placeholder="z.B. v1.0.3"
                className="w-full text-xs mt-1 p-1.5 border border-border rounded-lg bg-background"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                Aktiv
              </label>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Beschreibung (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Kurze Beschreibung…"
              rows={2}
              className="w-full text-xs mt-1 p-1.5 border border-border rounded-lg bg-background resize-none"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !form.name}
            className="w-full py-2 bg-[#22c55e] text-white rounded-lg text-sm font-bold hover:bg-[#16a34a] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Wird hochgeladen…" : "Upload"}
          </button>
        </div>
      )}

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Downloads…
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-3 py-4 text-center">
          Noch keine Downloads vorhanden.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 p-2 bg-card border border-border rounded-lg">
              {item.type === "apk"
                ? <Smartphone className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
                : <FileText className="w-4 h-4 text-[#00e5ff] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{item.name}</div>
                <div className="text-[9px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {item.version && <span className="font-mono">{item.version}</span>}
                  <span>{formatSize(item.file_size)}</span>
                  <span>·</span>
                  <span>{formatDate(item.upload_date)}</span>
                  <span className={`px-1 rounded ${item.is_active ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-500"}`}>
                    {item.is_active ? "aktiv" : "inaktiv"}
                  </span>
                </div>
              </div>
              <button onClick={() => handleToggle(item)} className="flex-shrink-0" title={item.is_active ? "Deaktivieren" : "Aktivieren"}>
                {item.is_active
                  ? <ToggleRight className="w-5 h-5 text-green-500" />
                  : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
              </button>
              <button onClick={() => handleDelete(item)} className="flex-shrink-0 text-muted-foreground hover:text-red-500" title="Löschen">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Avoid hydration mismatch — render neutral state until mounted
  const current = mounted ? (theme || "system") : "system";

  return (
    <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <Sun className="w-4 h-4" /> Erscheinungsbild
      </h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        Darstellung der App unabhängig vom System einstellen
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-colors ${
                active
                  ? "border-gray-900 dark:border-slate-100 bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  : "border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-5 h-5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
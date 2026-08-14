import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, Search } from "lucide-react";

/**
 * Password input with show/hide toggle and optional test button.
 * Points 1 & 2: password visibility + test functionality.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  label,
  autoComplete = "off",
  disabled = false,
  onTest = null,          // optional test callback → returns { success, message }
  testLabel = "Testen",
  testDisabled = false,  // disable test button even if onTest provided (e.g. empty value)
  helpLink = null,        // optional help link element
}) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    if (!onTest || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result || { success: false, message: "Keine Antwort" });
    } catch (e) {
      setTestResult({ success: false, message: e?.message || "Fehler beim Testen" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
          {helpLink}
        </div>
      )}
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          title={show ? "Passwort verbergen" : "Passwort anzeigen"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {onTest && (
        <div className="mt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || testDisabled || disabled}
            className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {testLabel}
          </button>
          {testResult && (
            <div className={`mt-1.5 p-2 rounded-lg text-xs flex items-start gap-1.5 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.success
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <span>{testResult.message}</span>
                {testResult.source && (
                  <span className="block text-[10px] opacity-60 mt-0.5">Quelle: {testResult.source}</span>
                )}
                {testResult.sourceResponse && (
                  <details className="mt-1">
                    <summary className="text-[10px] opacity-50 cursor-pointer select-none">Antwort der Quelle</summary>
                    <pre className="text-[9px] mt-1 p-1.5 bg-black/5 dark:bg-white/5 rounded overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all">{typeof testResult.sourceResponse === 'string' ? testResult.sourceResponse : JSON.stringify(testResult.sourceResponse, null, 2)}</pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
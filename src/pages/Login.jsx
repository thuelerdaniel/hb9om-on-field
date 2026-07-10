import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, FlaskConical, HelpCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Ungültige E-Mail oder Passwort");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("demoLogin", {});
      if (res.data?.access_token) {
        base44.auth.setToken(res.data.access_token);
        window.location.href = "/";
      } else {
        setError(res.data?.error || "Demo-Login fehlgeschlagen");
      }
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || "unbekannt";
      setError("Demo-Login fehlgeschlagen: " + detail);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Willkommen zurück"
      subtitle="Melde dich mit deinem Konto an"
      headerExtra={
        <Link to="/help" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors" title="Hilfe">
          <HelpCircle className="w-5 h-5" />
        </Link>
      }
      footer={
        <>
          Noch kein Konto?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Konto erstellen
          </Link>
        </>
      }
    >
      {/* Demo button - prominent and simple */}
      <div className="mb-6">
        <p className="text-center text-sm font-semibold text-gray-900 mb-2">Schnell reinschnuppern?</p>
        <p className="text-center text-xs text-muted-foreground mb-3">Mit einem Klick die App ausprobieren</p>
        <Button
          className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700"
          onClick={handleDemoLogin}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <FlaskConical className="w-5 h-5 mr-2" />
          )}
          Demo starten
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Demo-Daten werden täglich gelöscht
        </p>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">oder registrierte Benutzer</span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Mit Google fortfahren
      </Button>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="du@beispiel.ch"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Passwort</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Passwort vergessen?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Anmeldung...
            </>
          ) : (
            "Anmelden"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
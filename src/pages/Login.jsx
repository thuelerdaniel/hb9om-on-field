import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
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
      await base44.auth.loginViaEmailPassword(DEMO_EMAIL, DEMO_PASSWORD);
      window.location.href = "/";
    } catch (err) {
      setError("Demo-Login fehlgeschlagen: " + (err.message || "unbekannt"));
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
      footer={
        <>
          Noch kein Konto?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Konto erstellen
          </Link>
        </>
      }
    >
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm font-semibold text-blue-900">🔑 Demo-Zugang</p>
        <p className="text-blue-700 text-xs mt-1">
          Testen Sie die App: <strong>demo@hb9om.ch</strong> / <strong>demo123</strong>
        </p>
        <p className="text-blue-600 text-[10px] mt-0.5">Demo-Daten werden täglich gelöscht</p>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Mit Google fortfahren
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">oder</span>
        </div>
      </div>

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

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mt-3 border-blue-300 text-blue-700 hover:bg-blue-50"
        onClick={handleDemoLogin}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Als Demo-Benutzer anmelden
      </Button>
    </AuthLayout>
  );
}
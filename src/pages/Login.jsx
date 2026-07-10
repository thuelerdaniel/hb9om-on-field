import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2, FlaskConical } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <AuthLayout
      icon={LogIn}
      title="HB9OM On Field"
      subtitle="Amateurfunk Logbuch & Karten-App"
      footer={
        <>
          Eigenes Konto?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Registrieren
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      <Button
        className="w-full h-14 text-base font-semibold"
        onClick={handleDemoLogin}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Anmeldung...
          </>
        ) : (
          <>
            <FlaskConical className="w-5 h-5 mr-2" />
            Demo ausprobieren
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-3">
        Demo-Daten werden täglich gelöscht
      </p>
    </AuthLayout>
  );
}
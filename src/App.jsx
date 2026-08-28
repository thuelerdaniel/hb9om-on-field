import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { requestWakeLock, startWakeLockMonitor } from '@/lib/wakeLockManager';
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Settings from '@/pages/Settings';
import Log from '@/pages/Log';
import Help from '@/pages/Help';
const HuntingPage = lazy(() => import('@/pages/Hunting'));
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import ChangeRequests from '@/pages/ChangeRequests';
import AdminChangeRequests from '@/pages/AdminChangeRequests';
import AdminFeatureRequests from '@/pages/AdminFeatureRequests';
import UserManagement from '@/pages/UserManagement';
import OAuthConsent from '@/pages/OAuthConsent';
import PageNotFound from '@/lib/PageNotFound';
import TestReport from '@/pages/TestReport';
import ErrorBoundary from '@/components/ErrorBoundary';

function AuthenticatedApp() {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<ErrorBoundary name="Karte"><Home /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary name="Einstellungen"><Settings /></ErrorBoundary>} />
        <Route path="/log" element={<ErrorBoundary name="Logbuch"><Log /></ErrorBoundary>} />
        <Route path="/help" element={<ErrorBoundary name="Hilfe"><Help /></ErrorBoundary>} />
        <Route path="/hunting" element={
          <ErrorBoundary name="Hunting">
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0e17', color: '#4fd1c5', fontFamily: 'monospace' }}>Loading Hunting...</div>}>
              <HuntingPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/change-requests" element={<ChangeRequests />} />
        <Route path="/admin/change-requests" element={<AdminChangeRequests />} />
        <Route path="/admin/feature-requests" element={<AdminFeatureRequests />} />
        <Route path="/admin/users" element={<UserManagement />} />
      </Route>
      <Route path="/test-report" element={<TestReport />} />
      <Route path="/einstellungen" element={<Navigate to="/settings" replace />} />
      <Route path="/logbuch" element={<Navigate to="/log" replace />} />
      <Route path="/karte" element={<Navigate to="/" replace />} />
      <Route path="/hilfe" element={<Navigate to="/help" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    requestWakeLock();
    const stop = startWakeLockMonitor();
    // Service Worker + Cache Cleanup — verhindert veraltete Caches nach Updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(k => {
          if (k.includes('workbox') || k.includes('base44')) caches.delete(k);
        });
      });
    }

    // Global error handlers — prevent white-screen crashes on unhandled errors.
    // Errors are logged but do NOT crash the app; ErrorBoundary catches React errors.
    const handleGlobalError = (e) => {
      console.error('[Global Error]', e.error || e.message);
      e.preventDefault();
    };
    const handleUnhandledRejection = (e) => {
      console.error('[Unhandled Promise]', e.reason);
      e.preventDefault();
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearInterval(stop);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
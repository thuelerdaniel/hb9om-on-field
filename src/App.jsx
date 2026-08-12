import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
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
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import ChangeRequests from '@/pages/ChangeRequests';
import AdminChangeRequests from '@/pages/AdminChangeRequests';
import AdminFeatureRequests from '@/pages/AdminFeatureRequests';
import UserManagement from '@/pages/UserManagement';
import OAuthConsent from '@/pages/OAuthConsent';
import PageNotFound from '@/lib/PageNotFound';

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
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/log" element={<Log />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/change-requests" element={<ChangeRequests />} />
        <Route path="/admin/change-requests" element={<AdminChangeRequests />} />
        <Route path="/admin/feature-requests" element={<AdminFeatureRequests />} />
        <Route path="/admin/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
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
  )
}

export default App
import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { AnimalsPage } from './pages/AnimalsPage';
import { RoomsPage } from './pages/RoomsPage';
import { ProtocolsPage } from './pages/ProtocolsPage';
import { HealthRecordsPage } from './pages/HealthRecordsPage';
import { DeathReportsPage } from './pages/DeathReportsPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { BreedingsPage } from './pages/BreedingsPage';
import { CagesPage } from './pages/CagesPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { TrainingsPage } from './pages/TrainingsPage';
import { SignaturesPage } from './pages/SignaturesPage';
import { BillingPage } from './pages/BillingPage';
import { VetWorkbenchPage } from './pages/VetWorkbenchPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { VerifyPage } from './pages/VerifyPage';
import { RenewPage } from './pages/RenewPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { AdminPage } from './pages/AdminPage';
import { api } from './lib/api';
import { initPostHog, trackPageView } from './lib/posthog';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!api.getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** PostHog 页面浏览追踪 */
function PostHogTracker() {
  const location = useLocation();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <PostHogTracker />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/renew" element={<RenewPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="animals" element={<AnimalsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="protocols" element={<ProtocolsPage />} />
        <Route path="health-records" element={<HealthRecordsPage />} />
        <Route path="death-reports" element={<DeathReportsPage />} />
        <Route path="medications" element={<MedicationsPage />} />
        <Route path="breedings" element={<BreedingsPage />} />
        <Route path="cages" element={<CagesPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="trainings" element={<TrainingsPage />} />
        <Route path="signatures" element={<SignaturesPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="vet-workbench" element={<VetWorkbenchPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
    </>
  );
}

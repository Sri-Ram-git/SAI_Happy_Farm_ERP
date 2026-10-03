import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedManagementRoute } from './components/ProtectedManagementRoute';
import { ErrorBoundary } from './components/dashboard/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { FarmerFormPage } from './pages/FarmerFormPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { ManagementLoginPage } from './pages/management/ManagementLoginPage';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard';
import { SupervisorFarmsPage } from './pages/supervisor/SupervisorFarmsPage';
import { SupervisorFarmDetailPage } from './pages/supervisor/SupervisorFarmDetailPage';
import { SupervisorAnalyticsPage } from './pages/supervisor/SupervisorAnalyticsPage';
import { SupervisorRankingsPage } from './pages/supervisor/SupervisorRankingsPage';
import { SupervisorSubmissionsPage } from './pages/supervisor/SupervisorSubmissionsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminCreateFarmerPage } from './pages/admin/AdminCreateFarmerPage';
import { AdminCreateSupervisorPage } from './pages/admin/AdminCreateSupervisorPage';
import { AdminCreateAdminPage } from './pages/admin/AdminCreateAdminPage';
import { AdminEditSupervisorPage } from './pages/admin/AdminEditSupervisorPage';
import { AdminFarmsPage } from './pages/admin/AdminFarmsPage';
import { AdminFarmDetailPage } from './pages/admin/AdminFarmDetailPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage';
import { AdminImportPage } from './pages/admin/AdminImportPage';
import { FeedLoadPage } from './pages/admin/FeedLoadPage';
import { AdminFlocksPage } from './pages/admin/AdminFlocksPage';
import { PredictionPage } from './pages/admin/PredictionPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { DevNotificationTrigger } from './pages/DevNotificationTrigger';
import { LoadingScreen } from './components/LoadingScreen';
import { getRouteForRole } from './utils/routeByRole';
import './styles.css';

function RootRedirect() {
  const { role, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getRouteForRole(role || '')} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Farmer routes - EXACTLY as before */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/farmer/form"
        element={
          <ProtectedRoute allowedRole="farmer">
            <ErrorBoundary>
              <FarmerFormPage />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      {/* Management Login */}
      <Route path="/management/login" element={<ManagementLoginPage />} />

      {/* Supervisor routes */}
      <Route path="/supervisor" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorDashboard /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/overview" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorDashboard /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/farms" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorFarmsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/farms/:farmId" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorFarmDetailPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/analytics" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorAnalyticsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/rankings" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorRankingsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/submissions" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><SupervisorSubmissionsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminDashboard /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/overview" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminDashboard /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminUsersPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/users/create-farmer" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateFarmerPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/users/create-farmer" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateFarmerPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />

      <Route path="/admin/users/create-supervisor" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateSupervisorPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/users/create-supervisor" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateSupervisorPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/users/create-admin" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateAdminPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/users/create-admin" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminCreateAdminPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/users/edit-supervisor/:userId" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminEditSupervisorPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/users/edit-supervisor/:userId" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminEditSupervisorPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/farms" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminFarmsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/farms/:farmId" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminFarmDetailPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/flocks" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminFlocksPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/prediction" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><PredictionPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminAnalyticsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/submissions" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminSubmissionsPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/import" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><AdminImportPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/feed-load" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><FeedLoadPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/feed-load" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><FeedLoadPage /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/supervisor/notifications" element={
        <ProtectedManagementRoute allowedRoles={['supervisor']}>
          <ErrorBoundary><NotificationsPage role="supervisor" /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />
      <Route path="/admin/notifications" element={
        <ProtectedManagementRoute allowedRoles={['admin']}>
          <ErrorBoundary><NotificationsPage role="admin" /></ErrorBoundary>
        </ProtectedManagementRoute>
      } />

      {/* Dev routes */}
      {import.meta.env.DEV && (
        <Route path="/dev/trigger-notification" element={<DevNotificationTrigger />} />
      )}

      {/* Root */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

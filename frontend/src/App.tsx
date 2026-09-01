import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { FarmerFormPage } from './pages/FarmerFormPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { AdminPage } from './pages/AdminPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { LoadingScreen } from './components/LoadingScreen';
import { getRouteForRole } from './utils/routeByRole';
import './styles.css';

function RootRedirect() {
  const { role, loading, isAuthenticated } = useAuth();
  console.log('[RootRedirect] RENDER:', { loading, isAuthenticated, role });
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) {
    console.log('[RootRedirect] → /login');
    return <Navigate to="/login" replace />;
  }
  const dest = getRouteForRole(role || '');
  console.log('[RootRedirect] →', dest);
  return <Navigate to={dest} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/farmer/form"
        element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor"
        element={
          <ProtectedRoute allowedRole="supervisor">
            <SupervisorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />

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

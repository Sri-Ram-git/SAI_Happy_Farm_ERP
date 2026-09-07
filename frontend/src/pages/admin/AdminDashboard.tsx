import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { EnterpriseAnalyticsDashboard } from '../../components/dashboard/EnterpriseAnalyticsDashboard';

export function AdminDashboard() {
  const { userProfile } = useAuth();

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <EnterpriseAnalyticsDashboard role="admin" variant="overview" />
    </DashboardLayout>
  );
}

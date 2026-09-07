import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { EnterpriseAnalyticsDashboard } from '../../components/dashboard/EnterpriseAnalyticsDashboard';

export function SupervisorDashboard() {
  const { userProfile } = useAuth();

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <EnterpriseAnalyticsDashboard role="supervisor" variant="overview" />
    </DashboardLayout>
  );
}

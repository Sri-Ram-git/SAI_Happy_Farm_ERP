import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { EnterpriseAnalyticsDashboard } from '../../components/dashboard/EnterpriseAnalyticsDashboard';
import { useAuth } from '../../context/AuthContext';

export function SupervisorAnalyticsPage() {
  const { userProfile } = useAuth();

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <EnterpriseAnalyticsDashboard role="supervisor" variant="analytics" />
    </DashboardLayout>
  );
}


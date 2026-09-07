import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { EnterpriseAnalyticsDashboard } from '../../components/dashboard/EnterpriseAnalyticsDashboard';
import { useAuth } from '../../context/AuthContext';

export function AdminAnalyticsPage() {
  const { userProfile } = useAuth();

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <EnterpriseAnalyticsDashboard role="admin" variant="analytics" />
    </DashboardLayout>
  );
}


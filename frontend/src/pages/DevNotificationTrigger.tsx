import { useEffect } from 'react';
import { db } from '../config/firebase';
import { getIstDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

export function DevNotificationTrigger() {
  const navigate = useNavigate();

  useEffect(() => {
    if (import.meta.env.PROD) {
      navigate('/login');
      return;
    }

    const triggerNotification = async () => {
      try {
        const today = getIstDate();
        const docId = `test_notif_${Date.now()}`;
        await db.collection('notifications').doc(docId).set({
          id: docId,
          type: 'TEST_NOTIFICATION',
          priority: 'INFO',
          title: 'Notification Centre Test',
          message: 'Test notification generated successfully.',
          farmId: 'TEST_FARM_1',
          farmName: 'Test Farm',
          targetRoles: ['admin', 'supervisor'],
          createdAt: new Date().toISOString(),
          readBy: []
        });
        alert('Test notification created! ID: ' + docId);
        navigate(-1);
      } catch (e: any) {
        alert('Error: ' + e.message);
      }
    };
    triggerNotification();
  }, [navigate]);

  return <div>Generating test notification...</div>;
}

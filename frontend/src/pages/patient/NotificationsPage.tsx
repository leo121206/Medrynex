import React from 'react';
import { notificationService } from '../../services/notification.service';
import { NotificationItem } from '../../types/notification';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { useNotification } from '../../context/NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';
import { Bell, ShieldAlert, AlertOctagon, CheckCircle2, AlertTriangle, Check } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { showToast } = useNotification();
  const { data: notifications, loading, error, refetch } = useApiCall<NotificationItem[]>(
    () => notificationService.getNotifications(),
    []
  );

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      showToast('All notifications marked as read', 'info');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update notifications', 'error');
    }
  };

  const icons: Record<string, React.ReactNode> = {
    request: <ShieldAlert className="w-5 h-5 text-[#D9A441]" />,
    anomaly: <AlertTriangle className="w-5 h-5 text-[#D9A441]" />,
    emergency: <AlertOctagon className="w-5 h-5 text-[#C85C5C]" />,
    approved: <CheckCircle2 className="w-5 h-5 text-[#5F8D65]" />,
    expiring: <Bell className="w-5 h-5 text-[#668FA3]" />,
    reconciliation: <Bell className="w-5 h-5 text-[#47634C]" />,
    dispute: <AlertTriangle className="w-5 h-5 text-[#C85C5C]" />,
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Notification Center</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Real-time access requests, security anomaly flags, and break-glass alerts.
          </p>
        </div>
        {notifications.length > 0 && (
          <Button variant="secondary" size="sm" icon={<Check className="w-4 h-4" />} onClick={handleMarkAllRead}>
            Mark All Read
          </Button>
        )}
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && notifications.length === 0}
        emptyTitle="No notifications"
        emptyMessage="You're all caught up. Security and access notifications will appear here."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              padding="md"
              className={`flex items-start gap-4 transition-colors ${
                n.isRead ? 'bg-white' : 'bg-[#E7F0E4]/30 border-[#A8CBA0]'
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-[#DDE5DA] flex items-center justify-center shrink-0">
                {icons[n.category] || <Bell className="w-5 h-5 text-[#47634C]" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#26352A]">{n.title}</h4>
                  <span className="text-[11px] text-[#66736A]">
                    {n.timestamp || ((n as any).createdAt ? new Date((n as any).createdAt).toLocaleString() : '')}
                  </span>
                </div>
                <p className="text-xs text-[#66736A] leading-relaxed">{n.message}</p>
              </div>
            </Card>
          ))}
        </div>
      </ApiStateWrapper>
    </div>
  );
};

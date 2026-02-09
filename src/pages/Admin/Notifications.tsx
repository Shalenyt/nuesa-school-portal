import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { NotificationContent } from '@/components/Student/NotificationContent';

export default function AdminNotifications() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            View announcements and system notifications
          </p>
        </div>

        <NotificationContent />
      </div>
    </DashboardLayout>
  );
}

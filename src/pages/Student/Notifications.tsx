import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { NotificationContent } from '@/components/Student/NotificationContent';

export default function StudentNotifications() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with class schedules, materials, assignments, results and announcements
          </p>
        </div>

        <NotificationContent />
      </div>
    </DashboardLayout>
  );
}
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { ClassAverageCard } from '@/components/Teacher/ClassAverageCard';
import { HardestQuestions } from '@/components/Teacher/HardestQuestions';
import { AttendanceConsistency } from '@/components/Teacher/AttendanceConsistency';

export default function TeacherAnalytics() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Class performance metrics and insights</p>
        </div>

        <ClassAverageCard />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
          <HardestQuestions />
          <AttendanceConsistency />
        </div>
      </div>
    </DashboardLayout>
  );
}

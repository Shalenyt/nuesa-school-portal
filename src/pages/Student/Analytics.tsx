import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { GPACard } from '@/components/Student/GPACard';
import { AttendanceChart } from '@/components/Student/AttendanceChart';
import { QuizPerformanceChart } from '@/components/Student/QuizPerformanceChart';

export default function StudentAnalytics() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Your academic performance overview</p>
        </div>

        <GPACard />

        <div className="grid gap-6 md:grid-cols-2">
          <AttendanceChart />
          <QuizPerformanceChart />
        </div>
      </div>
    </DashboardLayout>
  );
}

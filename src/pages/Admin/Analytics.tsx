import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, BookOpen, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { DepartmentPerformance } from '@/components/Admin/DepartmentPerformance';
import { CourseSuccessRate } from '@/components/Admin/CourseSuccessRate';
import { TeacherGradingPerformance } from '@/components/Admin/TeacherGradingPerformance';
import { cn } from '@/lib/utils';

interface Summary {
  enrolled_students: number;
  course_registrations: number;
  total_students: number;
  students_at_month_start: number;
  new_students_this_month: number;
  new_students_last_month: number;
  total_courses: number;
  courses_with_students: number;
  submissions: number;
  graded_submissions: number;
}

// How often the numbers refresh on their own while the page is open
const REFRESH_MS = 60_000;

export default function Analytics() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // All numbers come from one database function, so they always match the database
  const fetchSummary = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await (supabase as any).rpc('admin_analytics_summary');
    if (error) {
      console.error('Error fetching analytics:', error);
      setFailed(true);
    } else {
      setSummary(data as Summary);
      setFailed(false);
      setUpdatedAt(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const refreshAll = useCallback(() => {
    fetchSummary();
    setRefreshKey((k) => k + 1);
  }, [fetchSummary]);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(refreshAll, REFRESH_MS);
    // Refresh when the admin comes back to the tab
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchSummary, refreshAll]);

  // Growth = change in the number of students since the start of this month
  const growth = (() => {
    if (!summary) return { value: '—', description: '' };
    const start = summary.students_at_month_start;
    const now = summary.total_students;
    const detail = `${summary.new_students_this_month} new this month · ${summary.new_students_last_month} last month`;
    if (start === 0) return { value: `+${summary.new_students_this_month}`, description: detail };
    const pct = Math.round(((now - start) / start) * 1000) / 10;
    return { value: `${pct > 0 ? '+' : ''}${pct}%`, description: detail };
  })();

  const cards = [
    {
      title: 'Enrolled Students',
      value: summary?.enrolled_students,
      icon: Users,
      description: summary
        ? `${summary.course_registrations} course registrations · ${summary.total_students} approved students`
        : 'Students registered for at least one course',
    },
    {
      title: 'Total Courses',
      value: summary?.total_courses,
      icon: BookOpen,
      description: summary ? `${summary.courses_with_students} have students registered` : 'Courses on the portal',
    },
    {
      title: 'Assignment Submissions',
      value: summary?.submissions,
      icon: BarChart3,
      description: summary ? `${summary.graded_submissions} graded` : 'Assignments submitted',
    },
    {
      title: 'Monthly Growth',
      value: growth.value,
      icon: TrendingUp,
      description: growth.description || 'Change in students this month',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Live school metrics{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {failed && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              Couldn't load the analytics.
              <Button size="sm" variant="outline" onClick={refreshAll}>Try again</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '-' : card.value ?? '—'}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <DepartmentPerformance refreshKey={refreshKey} />
          <CourseSuccessRate refreshKey={refreshKey} />
        </div>

        <TeacherGradingPerformance refreshKey={refreshKey} />
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { DepartmentPerformance } from '@/components/Admin/DepartmentPerformance';
import { CourseSuccessRate } from '@/components/Admin/CourseSuccessRate';
import { TeacherGradingPerformance } from '@/components/Admin/TeacherGradingPerformance';

export default function Analytics() {
  const [analytics, setAnalytics] = useState({
    totalEnrollments: 0,
    activeCourses: 0,
    completedAssignments: 0,
    monthlyGrowth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [enrollments, courses, assignments] = await Promise.all([
        supabase.from('student_enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('assignment_submissions').select('*', { count: 'exact', head: true })
      ]);

      setAnalytics({
        totalEnrollments: enrollments.count || 0,
        activeCourses: courses.count || 0,
        completedAssignments: assignments.count || 0,
        monthlyGrowth: 12.5
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyticsCards = [
    { title: "Total Enrollments", value: analytics.totalEnrollments, icon: Users, description: "Students enrolled in courses" },
    { title: "Active Courses", value: analytics.activeCourses, icon: BookOpen, description: "Currently running courses" },
    { title: "Completed Assignments", value: analytics.completedAssignments, icon: BarChart3, description: "Assignments submitted" },
    { title: "Monthly Growth", value: `${analytics.monthlyGrowth}%`, icon: TrendingUp, description: "Increase in enrollments" }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">School performance metrics and insights</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analyticsCards.map((card, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '-' : card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <DepartmentPerformance />
          <CourseSuccessRate />
        </div>

        <TeacherGradingPerformance />
      </div>
    </DashboardLayout>
  );
}

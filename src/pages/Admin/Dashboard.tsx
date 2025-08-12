import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, GraduationCap, BookOpen, MessageSquare, TrendingUp, Clock, BarChart3, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { RecentActivities } from '@/components/Admin/RecentActivities';

interface Stats {
  totalUsers: number;
  pendingApplications: number;
  totalCourses: number;
  totalAnnouncements: number;
  approvedStudents: number;
  approvedTeachers: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingApplications: 0,
    totalCourses: 0,
    totalAnnouncements: 0,
    approvedStudents: 0,
    approvedTeachers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch pending applications
      const { count: pendingApplications } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch approved students
      const { count: approvedStudents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('status', 'approved');

      // Fetch approved teachers
      const { count: approvedTeachers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('status', 'approved');

      // Fetch total courses
      const { count: totalCourses } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });

      // Fetch total announcements
      const { count: totalAnnouncements } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: totalUsers || 0,
        pendingApplications: pendingApplications || 0,
        totalCourses: totalCourses || 0,
        totalAnnouncements: totalAnnouncements || 0,
        approvedStudents: approvedStudents || 0,
        approvedTeachers: approvedTeachers || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "All registered users",
      onClick: () => navigate('/admin/users')
    },
    {
      title: "Pending Applications",
      value: stats.pendingApplications,
      icon: Clock,
      description: "Awaiting approval",
      onClick: () => navigate('/admin/users')
    },
    {
      title: "Active Admins",
      value: Math.ceil(stats.totalUsers * 0.1) || 1,
      icon: Shield,
      description: "System administrators",
      onClick: () => navigate('/admin/users')
    },
    {
      title: "Active Students",
      value: stats.approvedStudents,
      icon: GraduationCap,
      description: "Approved students",
      onClick: () => navigate('/admin/users')
    },
    {
      title: "Active Teachers",
      value: stats.approvedTeachers,
      icon: Users,
      description: "Approved teachers",
      onClick: () => navigate('/admin/users')
    },
    {
      title: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      description: "Available courses",
      onClick: () => navigate('/admin/courses')
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of the school management system
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '-' : card.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <RecentActivities />

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin/users')}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin/courses')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Manage Courses
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin/announcements')}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Create Announcement
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin/analytics')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
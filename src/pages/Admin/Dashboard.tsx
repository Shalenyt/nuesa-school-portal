import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, GraduationCap, BookOpen, MessageSquare, TrendingUp, Clock, BarChart3, Shield, UserCheck } from 'lucide-react';
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
  approvedAdmins: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingApplications: 0,
    totalCourses: 0,
    totalAnnouncements: 0,
    approvedStudents: 0,
    approvedTeachers: 0,
    approvedAdmins: 0
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

      // Fetch approved admins
      const { count: approvedAdmins } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
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
        approvedTeachers: approvedTeachers || 0,
        approvedAdmins: approvedAdmins || 0
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
      onClick: () => navigate('/admin/users'),
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
      iconBg: 'bg-green-100 dark:bg-green-900'
    },
    {
      title: "Pending Applications",
      value: stats.pendingApplications,
      icon: Clock,
      description: "Awaiting approval",
      onClick: () => navigate('/admin/users'),
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900'
    },
    {
      title: "Active Students",
      value: stats.approvedStudents,
      icon: GraduationCap,
      description: "Approved students",
      onClick: () => navigate('/admin/users'),
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900'
    },
    {
      title: "Active Lecturers",
      value: stats.approvedTeachers,
      icon: UserCheck,
      description: "Approved lecturers",
      onClick: () => navigate('/admin/users'),
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
      iconBg: 'bg-purple-100 dark:bg-purple-900'
    },
    {
      title: "Active Admins",
      value: stats.approvedAdmins,
      icon: Shield,
      description: "System administrators",
      onClick: () => navigate('/admin/users'),
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-900'
    },
    {
      title: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      description: "Available courses",
      onClick: () => navigate('/admin/courses'),
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900'
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of the NUESA management system
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card, index) => (
            <Card 
              key={index} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${card.bg}`}
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>
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
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: string;
  message: string;
  user_name: string;
  created_at: string;
}

export function RecentActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      // Fetch recent applications
      const { data: applications } = await supabase
        .from('profiles')
        .select('full_name, created_at, role')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent user approvals/rejections
      const { data: userUpdates } = await supabase
        .from('profiles')
        .select('full_name, updated_at, status')
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(2);

      // Fetch recent announcements
      const { data: announcements } = await supabase
        .from('announcements')
        .select('title, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent material uploads
      const { data: materials } = await supabase
        .from('materials')
        .select('title, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent courses added
      const { data: courses } = await (supabase as any)
        .from('courses')
        .select('created_at, subjects(name)')
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent course lists created
      const { data: courseLists } = await (supabase as any)
        .from('course_lists')
        .select('created_at, classes(name), subjects(name)')
        .order('created_at', { ascending: false })
        .limit(2);

      const recentActivities: Activity[] = [];

      // Add applications
      applications?.forEach(app => {
        recentActivities.push({
          id: `app-${app.created_at}`,
          type: 'application',
          message: `${app.full_name} applied as ${app.role}`,
          user_name: app.full_name,
          created_at: app.created_at
        });
      });

      // Add user status updates
      userUpdates?.forEach(user => {
        recentActivities.push({
          id: `user-${user.updated_at}`,
          type: 'user_status',
          message: `${user.full_name} was ${user.status}`,
          user_name: user.full_name,
          created_at: user.updated_at
        });
      });

      // Add announcements
      announcements?.forEach(ann => {
        recentActivities.push({
          id: `ann-${ann.created_at}`,
          type: 'announcement',
          message: `${(ann.profiles as any)?.full_name} created announcement: ${ann.title}`,
          user_name: (ann.profiles as any)?.full_name || 'Unknown',
          created_at: ann.created_at
        });
      });

      // Add materials
      materials?.forEach(mat => {
        recentActivities.push({
          id: `mat-${mat.created_at}`,
          type: 'material',
          message: `${(mat.profiles as any)?.full_name} uploaded: ${mat.title}`,
          user_name: (mat.profiles as any)?.full_name || 'Unknown',
          created_at: mat.created_at
        });
      });

      // Add courses
      courses?.forEach((course: any) => {
        recentActivities.push({
          id: `course-${course.created_at}`,
          type: 'course',
          message: `New course added: ${course.subjects?.name || 'Unknown'}`,
          user_name: 'System',
          created_at: course.created_at
        });
      });

      // Add course lists
      courseLists?.forEach(list => {
        recentActivities.push({
          id: `list-${list.created_at}`,
          type: 'course_list',
          message: `New course list created for ${(list.classes as any)?.name} - ${(list.subjects as any)?.name}`,
          user_name: 'Admin',
          created_at: list.created_at
        });
      });

      // Sort by date and take latest 8 for 4 columns layout
      recentActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(recentActivities.slice(0, 8));

    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'application': return 'bg-primary';
      case 'user_status': return 'bg-destructive';
      case 'announcement': return 'bg-accent';
      case 'material': return 'bg-secondary';
      case 'course': return 'bg-muted';
      case 'course_list': return 'bg-muted-foreground';
      default: return 'bg-muted';
    }
  };

  const getActivityTitle = (type: string) => {
    switch (type) {
      case 'application': return 'New Application';
      case 'user_status': return 'User Status Update';
      case 'announcement': return 'New Announcement';
      case 'material': return 'Material Uploaded';
      case 'course': return 'Course Added';
      case 'course_list': return 'Course List Created';
      default: return 'Activity';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Loading activities...</p>
        ) : activities.length === 0 ? (
          <p className="text-muted-foreground">No recent activities</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {activities.map((activity) => (
              <div key={activity.id} className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full`}></div>
                  <p className="font-medium text-xs">{getActivityTitle(activity.type)}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{activity.message}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
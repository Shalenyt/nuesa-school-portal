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
        .limit(3);

      // Fetch recent announcements
      const { data: announcements } = await supabase
        .from('announcements')
        .select('title, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(3);

      // Fetch recent material uploads
      const { data: materials } = await supabase
        .from('materials')
        .select('title, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(3);

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

      // Sort by date and take latest 5
      recentActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(recentActivities.slice(0, 5));

    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'application': return 'bg-primary';
      case 'announcement': return 'bg-accent';
      case 'material': return 'bg-secondary';
      default: return 'bg-muted';
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
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full`}></div>
                  <div>
                    <p className="font-medium text-sm">{activity.type === 'application' ? 'New Application' : activity.type === 'announcement' ? 'New Announcement' : 'Material Uploaded'}</p>
                    <p className="text-sm text-muted-foreground">{activity.message}</p>
                  </div>
                </div>
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
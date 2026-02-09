import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, MessageSquare, Calendar, Book, Trophy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  type: 'schedule' | 'material' | 'assignment' | 'result' | 'announcement';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'schedule': return <Calendar className="h-4 w-4" />;
    case 'material': return <Book className="h-4 w-4" />;
    case 'assignment': return <Calendar className="h-4 w-4" />;
    case 'result': return <Trophy className="h-4 w-4" />;
    case 'announcement': return <MessageSquare className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

function NotificationList({ items }: { items: Notification[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">No items</h3>
            <p className="mt-1 text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((notification) => (
        <Card key={notification.id} className={!notification.read ? 'border-primary' : ''}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {notification.title}
                    {!notification.read && <Badge variant="secondary">New</Badge>}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function NotificationContent() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [generalNotifications, setGeneralNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchRealNotifications();
  }, [profile]);

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  const fetchRealNotifications = async () => {
    try {
      const general: Notification[] = [];
      const announcementList: Notification[] = [];

      // Fetch class schedules
      const { data: schedules } = await (supabase as any)
        .from('timetable')
        .select(`*, courses!inner(name, subjects(name, code), student_enrollments!inner(student_id))`)
        .eq('courses.student_enrollments.student_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      schedules?.forEach((schedule: any) => {
        general.push({
          id: `schedule-${schedule.id}`,
          type: 'schedule',
          title: 'New Class Schedule',
          message: `${schedule.courses?.name || schedule.courses?.subjects?.code || 'Course'} scheduled for ${getDayName(schedule.day_of_week)} at ${schedule.start_time}`,
          created_at: schedule.created_at,
          read: false
        });
      });

      // Fetch new materials
      const { data: materials } = await (supabase as any)
        .from('materials')
        .select(`*, courses!inner(name, subjects(name, code), student_enrollments!inner(student_id))`)
        .eq('courses.student_enrollments.student_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      materials?.forEach((material: any) => {
        general.push({
          id: `material-${material.id}`,
          type: 'material',
          title: 'New Course Material',
          message: `${material.title} uploaded for ${material.courses?.name || material.courses?.subjects?.code || 'Course'}`,
          created_at: material.created_at,
          read: false
        });
      });

      // Fetch assignments
      const { data: assignments } = await (supabase as any)
        .from('assignments')
        .select(`*, courses!inner(name, subjects(name, code), student_enrollments!inner(student_id))`)
        .eq('courses.student_enrollments.student_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      assignments?.forEach((assignment: any) => {
        general.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          title: 'New Assignment',
          message: `${assignment.title} assigned for ${assignment.courses?.name || assignment.courses?.subjects?.code || 'Course'}`,
          created_at: assignment.created_at,
          read: false
        });
      });

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(10);

      announcementsData?.forEach((announcement: any) => {
        announcementList.push({
          id: `announcement-${announcement.id}`,
          type: 'announcement',
          title: `${announcement.profiles?.role === 'admin' ? 'Admin' : 'Teacher'} Announcement`,
          message: announcement.title,
          created_at: announcement.created_at,
          read: false
        });
      });

      general.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      announcementList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setGeneralNotifications(general.slice(0, 10));
      setAnnouncements(announcementList.slice(0, 10));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center">Loading notifications...</div>;

  return (
    <Tabs defaultValue="announcements" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="announcements">
          Announcements {announcements.length > 0 && <Badge variant="secondary" className="ml-2">{announcements.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="general">
          General Notifications {generalNotifications.length > 0 && <Badge variant="secondary" className="ml-2">{generalNotifications.length}</Badge>}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="announcements">
        <NotificationList items={announcements} />
      </TabsContent>
      <TabsContent value="general">
        <NotificationList items={generalNotifications} />
      </TabsContent>
    </Tabs>
  );
}

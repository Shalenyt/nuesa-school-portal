import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, MessageSquare, Calendar, Book, Trophy, ClipboardList, CheckCircle, UserPlus, AlertCircle, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  type: 'schedule' | 'material' | 'assignment' | 'result' | 'announcement' | 'quiz' | 'attendance' | 'grade' | 'user_registration' | 'submission' | 'system_alert';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  db_id?: string;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'schedule': return <Calendar className="h-4 w-4" />;
    case 'material': return <Book className="h-4 w-4" />;
    case 'assignment': return <ClipboardList className="h-4 w-4" />;
    case 'result': return <Trophy className="h-4 w-4" />;
    case 'announcement': return <MessageSquare className="h-4 w-4" />;
    case 'quiz': return <Book className="h-4 w-4" />;
    case 'attendance': return <CheckCircle className="h-4 w-4" />;
    case 'grade': return <Trophy className="h-4 w-4" />;
    case 'user_registration': return <UserPlus className="h-4 w-4" />;
    case 'submission': return <FileText className="h-4 w-4" />;
    case 'system_alert': return <AlertCircle className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

function NotificationList({ items, onItemClick }: { items: Notification[]; onItemClick: (item: Notification) => void }) {
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
        <Card 
          key={notification.id} 
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notification.read ? 'border-primary' : ''}`}
          onClick={() => onItemClick(notification)}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {notification.title}
                    {!notification.read && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">New</Badge>}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
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
  const [selectedItem, setSelectedItem] = useState<Notification | null>(null);

  useEffect(() => {
    if (profile) fetchAll();

    const announcementChannel = supabase
      .channel('student-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        if (profile) fetchAnnouncements();
      })
      .subscribe();

    const notificationChannel = supabase
      .channel('student-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile?.id}` }, () => {
        if (profile) fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [profile]);

  const fetchAll = async () => {
    await Promise.all([fetchAnnouncements(), fetchNotifications()]);
    setLoading(false);
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(20);

    const list: Notification[] = (data || []).map((a: any) => ({
      id: `announcement-${a.id}`,
      type: 'announcement' as const,
      title: `${a.profiles?.role === 'admin' ? 'Admin' : 'Lecturer'} Announcement: ${a.title}`,
      message: a.content || '',
      created_at: a.created_at,
      read: true, // announcements don't track read per student
    }));

    setAnnouncements(list);
  };

  const fetchNotifications = async () => {
    if (!profile) return;

    const { data: dbNotifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const items: Notification[] = (dbNotifications || []).map((n: any) => ({
      id: `notification-${n.id}`,
      type: n.type as any,
      title: n.title,
      message: n.message,
      created_at: n.created_at,
      read: n.is_read || false,
      db_id: n.id,
    }));

    setGeneralNotifications(items);
  };

  const markAsRead = async (item: Notification) => {
    if (item.db_id && !item.read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.db_id);

      setGeneralNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, read: true } : n)
      );
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!profile) return;
    const unread = generalNotifications.filter(n => !n.read && n.db_id);
    if (unread.length === 0) return;
    
    const ids = unread.map(n => n.db_id!);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    setGeneralNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleItemClick = (item: Notification) => {
    setSelectedItem(item);
    markAsRead(item);
  };

  const handleTabChange = (value: string) => {
    if (value === 'general') {
      markAllNotificationsAsRead();
    }
  };

  if (loading) return <div className="text-center">Loading notifications...</div>;

  const unreadNotifications = generalNotifications.filter(n => !n.read).length;

  return (
    <>
      <Tabs defaultValue="announcements" className="w-full" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="announcements" className="relative">
            Announcements
            {announcements.length > 0 && (
              <Badge variant="secondary" className="ml-2">{announcements.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="general" className="relative">
            Notifications
            {unreadNotifications > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadNotifications}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="announcements">
          <NotificationList items={announcements} onItemClick={handleItemClick} />
        </TabsContent>
        <TabsContent value="general">
          <NotificationList items={generalNotifications} onItemClick={handleItemClick} />
        </TabsContent>
      </Tabs>

      {/* Detail popup */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedItem && getNotificationIcon(selectedItem.type)}
              <DialogTitle>{selectedItem?.title}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedItem?.message}</p>
            <p className="text-xs text-muted-foreground">
              {selectedItem && formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true })}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

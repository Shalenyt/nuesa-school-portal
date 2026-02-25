import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { NotificationContent } from '@/components/Student/NotificationContent';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, AlertCircle, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
}

export default function AdminNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchNotifications();
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        if (profile) fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications((data || []).map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      created_at: n.created_at,
      read: n.is_read || false,
    })));
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'user_registration': return <UserPlus className="h-4 w-4" />;
      case 'system_alert': return <ShieldCheck className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            View announcements and system notifications
          </p>
        </div>

        <Tabs defaultValue="announcements" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="notifications">
              Notifications
              {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="announcements">
            <NotificationContent />
          </TabsContent>
          <TabsContent value="notifications">
            {loading ? <div className="text-center">Loading...</div> : (
              <div className="space-y-4">
                {notifications.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">No notifications</CardContent>
                  </Card>
                ) : (
                  notifications.map(n => (
                    <Card key={n.id} className={`cursor-pointer hover:bg-muted/50 ${!n.read ? 'border-primary' : ''}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getIcon(n.type)}
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {n.title}
                                {!n.read && <Badge variant="destructive" className="text-[10px]">New</Badge>}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          {!n.read && <button onClick={() => markAsRead(n.id)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Mark as read</button>}
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

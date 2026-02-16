import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { NotificationContent } from '@/components/Student/NotificationContent';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, AlertCircle } from 'lucide-react';

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'user_registration' | 'system_alert';
  created_at: string;
  read: boolean;
}

export default function AdminNotifications() {
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .in('type', ['user_registration', 'system_alert'])
        .order('created_at', { ascending: false })
        .limit(20);

      setSystemNotifications((data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as any,
        created_at: n.created_at,
        read: n.is_read || false,
      })));
      setLoading(false);
    };

    fetchSystemNotifications();
    const channel = supabase
      .channel('admin-system-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `type=in.(user_registration,system_alert)` }, () => {
        fetchSystemNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setSystemNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (type: string) => {
    return type === 'user_registration' ? <UserPlus className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />;
  };

  const unreadCount = systemNotifications.filter(n => !n.read).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            View announcements, system alerts, and user registration notifications
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All Notifications</TabsTrigger>
            <TabsTrigger value="system">
              System Alerts
              {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <NotificationContent />
          </TabsContent>
          <TabsContent value="system">
            {loading ? <div className="text-center">Loading...</div> : (
              <div className="space-y-4">
                {systemNotifications.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">No system notifications</CardContent>
                  </Card>
                ) : (
                  systemNotifications.map(n => (
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

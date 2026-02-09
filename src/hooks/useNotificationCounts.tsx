import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NotificationCounts {
  announcements: number;
  notifications: number;
  total: number;
}

export function useNotificationCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ announcements: 0, notifications: 0, total: 0 });

  useEffect(() => {
    if (!profile) return;
    fetchCounts();

    const notificationChannel = supabase
      .channel('notification-count-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile?.id}` }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [profile]);

  const fetchCounts = async () => {
    if (!profile) return;

    const { count: notificationCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    const n = notificationCount || 0;
    setCounts({ announcements: 0, notifications: n, total: n });
  };

  return { counts, refetch: fetchCounts };
}

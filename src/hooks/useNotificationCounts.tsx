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
    if (profile?.role !== 'student') return;
    fetchCounts();

    // Subscribe to real-time changes
    const announcementChannel = supabase
      .channel('announcement-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchCounts())
      .subscribe();

    const notificationChannel = supabase
      .channel('notification-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile?.id}` }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [profile]);

  const fetchCounts = async () => {
    if (!profile) return;

    const [{ count: announcementCount }, { count: notificationCount }] = await Promise.all([
      supabase.from('announcements').select('id', { count: 'exact', head: true }),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).eq('is_read', false)
    ]);

    const a = announcementCount || 0;
    const n = notificationCount || 0;
    setCounts({ announcements: a, notifications: n, total: a + n });
  };

  return { counts, refetch: fetchCounts };
}

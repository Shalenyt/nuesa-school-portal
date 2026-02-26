import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useFeedbackCounts() {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    fetchCount();

    const channel = supabase
      .channel('feedback-count-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchCount = async () => {
    if (!profile || profile.role !== 'admin') return;
    const { count } = await (supabase as any)
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    setUnreadCount(count || 0);
  };

  return { unreadCount, refetch: fetchCount };
}

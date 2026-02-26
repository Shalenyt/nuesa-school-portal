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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchCount = async () => {
    if (!profile || profile.role !== 'admin') return;
    // Count feedback from last 7 days as "new"
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count } = await supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    setUnreadCount(count || 0);
  };

  return { unreadCount, refetch: fetchCount };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function HighPriorityNotification() {
  const { profile } = useAuth();
  const [notification, setNotification] = useState<any>(null);

  useEffect(() => {
    if (profile) fetchHighPriority();
  }, [profile]);

  const fetchHighPriority = async () => {
    const { data } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', profile!.id)
      .eq('priority', 'high')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setNotification(data);
  };

  const acknowledge = async () => {
    if (!notification) return;
    await (supabase as any)
      .from('notifications')
      .update({ acknowledged: true, is_read: true })
      .eq('id', notification.id);
    setNotification(null);
  };

  if (!notification) return null;

  return (
    <Dialog open={!!notification} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {notification.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm">{notification.message}</p>
        <DialogFooter>
          <Button onClick={acknowledge}>I Acknowledge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

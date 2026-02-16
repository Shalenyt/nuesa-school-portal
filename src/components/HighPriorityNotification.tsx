import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function HighPriorityNotification() {
  const { profile } = useAuth();
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    if (profile) fetchUrgentAnnouncements();
  }, [profile]);

  const fetchUrgentAnnouncements = async () => {
    if (!profile) return;

    // Fetch urgent announcements that the user has NOT read
    const { data: readIds } = await (supabase as any)
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', profile.id);

    const readSet = new Set((readIds || []).map((r: any) => r.announcement_id));

    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('type', 'urgent')
      .order('created_at', { ascending: false })
      .limit(10);

    const unread = (data || []).find((a: any) => !readSet.has(a.id));
    if (unread) setAnnouncement(unread);
  };

  const markAsRead = async () => {
    if (!announcement || !profile) return;
    await (supabase as any).from('announcement_reads').insert({
      announcement_id: announcement.id,
      user_id: profile.id,
    });
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <Dialog open={!!announcement} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {announcement.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{announcement.content}</p>
        <DialogFooter>
          <Button onClick={markAsRead}>I Acknowledge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

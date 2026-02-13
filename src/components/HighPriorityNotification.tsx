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
    // Fetch unread urgent announcements
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('type', 'urgent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setAnnouncement(data);
  };

  const markAsRead = async () => {
    if (!announcement) return;
    // In a real app, you'd track announcement reads per user
    // For now, we just close the modal
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

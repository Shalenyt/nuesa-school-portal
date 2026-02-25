import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

const STORAGE_KEY = 'notification_permission_state';
const DENIED_RETRY_DAYS = 5;

export function PushNotificationPrompt() {
  const { permission, supported, requestPermission } = usePushNotifications();
  const { profile } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!supported || !profile) return;
    
    // Already granted or denied at browser level
    if (permission === 'granted') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'granted', timestamp: Date.now() }));
      return;
    }

    if (permission === 'denied') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'denied', timestamp: Date.now() }));
      return;
    }

    // permission === 'default' - check localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.status === 'granted') return; // Already granted
        if (parsed.status === 'denied' || parsed.status === 'dismissed') {
          const daysSince = (Date.now() - parsed.timestamp) / (1000 * 60 * 60 * 24);
          if (daysSince < DENIED_RETRY_DAYS) return; // Wait before asking again
        }
      } catch {}
    }

    // Show prompt after delay
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [supported, permission, profile]);

  const handleAllow = async () => {
    const granted = await requestPermission();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
      status: granted ? 'granted' : 'denied', 
      timestamp: Date.now() 
    }));
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'dismissed', timestamp: Date.now() }));
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Enable Notifications
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Stay updated with new announcements, assignments, quizzes, grades, and attendance sessions. 
          You'll receive instant notifications even when you're not on the portal.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDismiss}>Not Now</Button>
          <Button onClick={handleAllow}>Allow Notifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

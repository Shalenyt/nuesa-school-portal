import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export function PushNotificationPrompt() {
  const { permission, supported, requestPermission } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!supported) return;
    if (permission !== 'default') return;
    
    // Show prompt after 2 seconds for any user who hasn't granted/denied yet
    const timer = setTimeout(() => setShowPrompt(true), 2000);
    return () => clearTimeout(timer);
  }, [supported, permission]);

  const handleAllow = async () => {
    await requestPermission();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push-notification-dismissed', 'true');
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

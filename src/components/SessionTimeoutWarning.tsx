import { useAutoLogout } from '@/hooks/useAutoLogout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export function SessionTimeoutWarning() {
  const { showWarning, countdown, extendSession, signOut } = useAutoLogout();

  if (!showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={(open) => { if (!open) extendSession(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive" />
            Session Timeout
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You've been inactive. Your session will expire in{' '}
          <span className="font-bold text-destructive">{countdown}s</span>.
        </p>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
          <Button onClick={extendSession}>Stay Logged In</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

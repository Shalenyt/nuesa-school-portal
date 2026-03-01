import { useAutoLogout } from '@/hooks/useAutoLogout';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export function SessionTimeoutWarning() {
  const { showWarning, countdown, extendSession, signOut } = useAutoLogout();

  if (!showWarning) return null;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="max-w-sm" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive" />
            Session Timeout
          </AlertDialogTitle>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          You've been inactive. Your session will expire in{' '}
          <span className="font-bold text-destructive">{countdown}s</span>.
        </p>
        <AlertDialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
          <Button onClick={extendSession}>Stay Logged In</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

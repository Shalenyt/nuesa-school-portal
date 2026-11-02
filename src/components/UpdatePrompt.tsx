import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** How often an open portal checks for a new version */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Tells people when a new version of the portal is out and lets them switch
 * with one tap. Works the same in a browser tab and in the installed app.
 * The portal stays installable and usable offline; it just no longer keeps
 * running an old version until someone happens to reopen it.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      // Check regularly while open, and whenever the person comes back to it
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;

  // pointer-events-auto: open popups switch off clicks on the rest of the
  // page, which would otherwise make "Update now" untappable.

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-background p-3 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">A new version of the portal is available</p>
        <p className="text-xs text-muted-foreground">Update to get the latest changes.</p>
      </div>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Update now
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        aria-label="Later"
        onClick={() => setNeedRefresh(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

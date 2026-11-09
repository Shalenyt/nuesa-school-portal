import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** How often an open portal checks for a new version */
const CHECK_EVERY_MS = 10 * 60 * 1000;
/** A page this young has nothing to lose, so it switches straight away */
const FRESH_MS = 30 * 1000;

const loadedAt = Date.now();
let typedSinceLoad = false;
if (typeof document !== 'undefined') {
  document.addEventListener('input', () => { typedSinceLoad = true; }, { capture: true });
}

// Public and sign in pages switch silently unless something has been typed
const isQuietPage = (path: string) =>
  path === '/' || path.startsWith('/auth/') || path.startsWith('/verify');

/**
 * New versions install and take over by themselves (the service worker skips
 * waiting), so the next time anyone opens the portal they get the latest
 * version without tapping anything. An already open page reloads on its own
 * when it was only just opened, or is a public or sign in page with nothing
 * typed yet. Otherwise a small banner offers the switch, so nobody loses work.
 */
export function UpdatePrompt() {
  const [show, setShow] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      check();
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // No controller yet means this is the first install, not an update
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) return;
      const fresh = Date.now() - loadedAt < FRESH_MS;
      if (fresh || (isQuietPage(window.location.pathname) && !typedSinceLoad)) {
        window.location.reload();
      } else {
        setShow(true);
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!show && !needRefresh) return null;

  const dismiss = () => {
    setShow(false);
    setNeedRefresh(false);
  };
  const update = () => {
    if (needRefresh) updateServiceWorker(true);
    else window.location.reload();
  };

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
      <Button size="sm" onClick={update}>
        Update now
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        aria-label="Later"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

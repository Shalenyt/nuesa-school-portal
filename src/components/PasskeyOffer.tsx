import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  PreparedRegistration,
  isCancel,
  isFresh,
  passkeysSupported,
  prepareRegistration,
  registerPasskey,
} from '@/lib/passkeys';

const OFFER_KEY = 'nuesa_offer_passkey';
const savedKey = (id: string) => `nuesa_passkey_saved_${id}`;
const skipKey = (id: string) => `nuesa_passkey_skip_${id}`;
const SKIP_DAYS = 14;

const read = (store: Storage, key: string) => { try { return store.getItem(key); } catch { return null; } };
const write = (store: Storage, key: string, v: string) => { try { store.setItem(key, v); } catch { /* ignore */ } };
const remove = (store: Storage, key: string) => { try { store.removeItem(key); } catch { /* ignore */ } };

/** Called after a password sign in, so the dashboard offers a passkey once */
export function markPasskeyOffer(userId: string) {
  write(sessionStorage, OFFER_KEY, userId);
}

/**
 * After someone signs in with their password, offers to save a passkey on this
 * device (Face ID, Touch ID, fingerprint or screen lock) so next time they can
 * sign in with one tap. Not shown again on this device once saved, and waits
 * two weeks after "Not now".
 */
export function PasskeyOffer() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const prepared = useRef<PreparedRegistration | null>(null);

  useEffect(() => {
    if (!user || profile?.status !== 'approved' || !passkeysSupported()) return;
    if (read(sessionStorage, OFFER_KEY) !== user.id) return;
    remove(sessionStorage, OFFER_KEY);
    if (read(localStorage, savedKey(user.id))) return;
    const skipped = Number(read(localStorage, skipKey(user.id)) || 0);
    if (skipped && Date.now() - skipped < SKIP_DAYS * 86400000) return;

    let cancelled = false;
    // Get the challenge first, so the prompt opens straight from the tap
    prepareRegistration()
      .then((p) => {
        if (cancelled) return;
        prepared.current = p;
        setTimeout(() => !cancelled && setOpen(true), 900);
      })
      .catch(() => { /* passkeys off or session issue: just skip */ });
    return () => { cancelled = true; };
  }, [user, profile?.status]);

  if (!user) return null;

  const notNow = () => {
    write(localStorage, skipKey(user.id), String(Date.now()));
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const p = isFresh(prepared.current) ? prepared.current! : await prepareRegistration();
      prepared.current = null;
      await registerPasskey(p);
      write(localStorage, savedKey(user.id), String(Date.now()));
      setOpen(false);
      toast({ title: 'Passkey saved', description: 'Next time, tap "Sign in with passkey" on the login page.' });
    } catch (e: any) {
      if (e?.code === 'exists') {
        write(localStorage, savedKey(user.id), String(Date.now()));
        setOpen(false);
        toast({ title: 'Passkey already saved', description: 'This device already has a passkey for your account.' });
      } else if (!isCancel(e)) {
        toast({ title: "Couldn't save the passkey", description: 'Please try again later.', variant: 'destructive' });
        setOpen(false);
      }
      // Cancelled: keep the dialog open so they can try again or choose Not now
      if (isCancel(e)) prepareRegistration().then((np) => { prepared.current = np; }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) notNow(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center gap-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Sign in faster next time</DialogTitle>
          <DialogDescription className="text-center">
            Save a passkey on this device and sign in with Face ID, your fingerprint or screen lock instead of your password.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
            Save passkey
          </Button>
          <Button variant="ghost" onClick={notNow} disabled={saving}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

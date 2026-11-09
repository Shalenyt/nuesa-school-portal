import { supabase } from '@/integrations/supabase/client';

// A random id kept in this browser, so admins can see when several accounts
// were created or used from the same phone or computer. It identifies the
// browser only, never the person.
const KEY = 'nuesa_device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

/** Notes this device and network against the signed in account (once a day at most). */
export async function recordAccountSignal(event: 'sign_up' | 'sign_in' = 'sign_in') {
  try {
    await supabase.rpc('record_account_signal' as any, { p_device_id: getDeviceId(), p_event: event });
  } catch {
    /* never block sign in on this */
  }
}

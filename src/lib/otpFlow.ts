// Keeps track of a pending email code (signup, password reset or email change)
// so the code screen survives a refresh. Stored in sessionStorage only: it holds
// the address the code went to, never the code itself.

export type OtpPurpose = 'signup' | 'recovery' | 'email_change';

export interface PendingOtp {
  purpose: OtpPurpose;
  email: string;        // address the code was sent to (new address for email change)
  oldEmail?: string;    // email change: current address (gets its own code when secure change is on)
  sentAt: number;       // ms timestamp of the last send, drives the resend countdown
  back: string;         // where the back arrow goes
}

const KEY = 'nuesa_pending_otp';
const MAX_AGE_MS = 60 * 60 * 1000;
export const RESEND_SECONDS = 30;

export function savePendingOtp(p: Omit<PendingOtp, 'sentAt'> & { sentAt?: number }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, sentAt: p.sentAt ?? Date.now() }));
  } catch {
    /* storage blocked: the page falls back to the login screen */
  }
}

export function loadPendingOtp(): PendingOtp | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOtp;
    if (!p?.email || !p?.purpose || Date.now() - p.sentAt > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function touchPendingOtp() {
  const p = loadPendingOtp();
  if (p) savePendingOtp({ ...p, sentAt: Date.now() });
}

export function clearPendingOtp() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Set after a reset code is accepted, so the new password page knows the session
// came from a verified code for this user.
const RECOVERY_KEY = 'nuesa_recovery_verified';
export function markRecoveryVerified(userId: string) {
  try { sessionStorage.setItem(RECOVERY_KEY, userId); } catch { /* ignore */ }
}
export function isRecoveryVerified(userId?: string | null) {
  try { return !!userId && sessionStorage.getItem(RECOVERY_KEY) === userId; } catch { return false; }
}
export function clearRecoveryVerified() {
  try { sessionStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
}

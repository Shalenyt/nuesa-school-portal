/**
 * Canonical public base URL for anything that leaves the browser
 * (QR codes, shared verification links, printed IDs).
 *
 * Production always resolves to the NUESA domain so that QR codes never
 * embed a preview/Vercel/localhost host. During local development the
 * current origin is used so links remain testable.
 */
const PRODUCTION_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://nuesa.org'
).replace(/\/+$/, '');

export function getPublicAppUrl(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }
  return PRODUCTION_APP_URL;
}

/** Public, login-free verification link for a single student. */
export function studentVerifyUrl(publicStudentId: string): string {
  return `${getPublicAppUrl()}/verify/student/${publicStudentId}`;
}

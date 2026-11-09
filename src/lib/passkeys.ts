// Passkeys (Face ID, Touch ID, fingerprint, screen lock) through Supabase Auth.
//
// Talks to Supabase's passkey endpoints directly with the same request and
// response formats as supabase-js (auth.passkey). The challenge is fetched
// ahead of time so the browser prompt opens straight from the tap: Safari on
// iPhone refuses a passkey prompt that starts after a network wait.

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://nzxvupidbjcfinoztmrd.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eHZ1cGlkYmpjZmlub3p0bXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTM1NTEsImV4cCI6MjA4NjA2OTU1MX0.bxcwhEP_nPrKrJyJRn0JkbZj1pgi3tZtom2inU9Pp-M';
const AUTH = `${SUPABASE_URL}/auth/v1`;
/** Challenges last 5 minutes on the server; refresh a little earlier */
const CHALLENGE_TTL_MS = 4 * 60 * 1000;

export class PasskeyError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function conditionalPasskeysAvailable(): Promise<boolean> {
  try {
    const pkc = window.PublicKeyCredential as any;
    return passkeysSupported() && typeof pkc.isConditionalMediationAvailable === 'function'
      ? await pkc.isConditionalMediationAvailable()
      : false;
  } catch {
    return false;
  }
}

// base64url helpers
const toBytes = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const toB64url = (buf: ArrayBuffer | null | undefined) => {
  if (!buf) return undefined;
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function call(path: string, body: unknown, accessToken?: string, method = 'POST') {
  const res = await fetch(`${AUTH}${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? ANON_KEY}`,
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PasskeyError(data?.msg || data?.message || data?.error_description || 'Passkey request failed', data?.error_code || data?.code);
  }
  return data;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new PasskeyError('Not signed in', 'no_session');
  return data.session.access_token;
}

/* ---------------- Sign in ---------------- */

export interface PreparedSignIn {
  challengeId: string;
  publicKey: PublicKeyCredentialRequestOptions;
  fetchedAt: number;
}

export async function prepareSignIn(): Promise<PreparedSignIn> {
  const data = await call('/passkeys/authentication/options', { gotrue_meta_security: {} });
  const o = data.options;
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...o,
    challenge: toBytes(o.challenge),
    allowCredentials: (o.allowCredentials || []).map((c: any) => ({ ...c, type: c.type || 'public-key', id: toBytes(c.id) })),
  };
  if (!publicKey.allowCredentials?.length) delete (publicKey as any).allowCredentials;
  return { challengeId: data.challenge_id, publicKey, fetchedAt: Date.now() };
}

export const isFresh = (p?: { fetchedAt: number } | null) => !!p && Date.now() - p.fetchedAt < CHALLENGE_TTL_MS;

/** Runs the passkey prompt and signs the person in. Returns the user id. */
export async function signInWithPasskey(
  prepared: PreparedSignIn,
  opts: { mediation?: 'conditional'; signal?: AbortSignal } = {}
): Promise<string> {
  const cred = (await navigator.credentials.get({
    publicKey: prepared.publicKey,
    mediation: opts.mediation as CredentialMediationRequirement | undefined,
    signal: opts.signal,
  } as CredentialRequestOptions)) as PublicKeyCredential | null;
  if (!cred) throw new PasskeyError('No passkey chosen', 'cancelled');

  const r = cred.response as AuthenticatorAssertionResponse;
  const credential = {
    id: cred.id,
    rawId: cred.id,
    type: 'public-key',
    response: {
      authenticatorData: toB64url(r.authenticatorData),
      clientDataJSON: toB64url(r.clientDataJSON),
      signature: toB64url(r.signature),
      userHandle: toB64url(r.userHandle),
    },
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: (cred as any).authenticatorAttachment ?? undefined,
  };

  const data = await call('/passkeys/authentication/verify', { challenge_id: prepared.challengeId, credential });
  const access_token = data.access_token ?? data.session?.access_token;
  const refresh_token = data.refresh_token ?? data.session?.refresh_token;
  if (!access_token || !refresh_token) throw new PasskeyError('Sign in failed', 'no_session');
  const { data: s, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !s.user) throw new PasskeyError(error?.message || 'Sign in failed', 'no_session');
  return s.user.id;
}

/* ---------------- Register ---------------- */

export interface PreparedRegistration {
  challengeId: string;
  publicKey: PublicKeyCredentialCreationOptions;
  fetchedAt: number;
}

export async function prepareRegistration(): Promise<PreparedRegistration> {
  const data = await call('/passkeys/registration/options', {}, await accessToken());
  const o = data.options;
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...o,
    challenge: toBytes(o.challenge),
    user: { ...o.user, id: toBytes(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map((c: any) => ({ ...c, type: c.type || 'public-key', id: toBytes(c.id) })),
  };
  return { challengeId: data.challenge_id, publicKey, fetchedAt: Date.now() };
}

/** Runs the create prompt and saves the passkey to the signed in account. */
export async function registerPasskey(prepared: PreparedRegistration): Promise<void> {
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({ publicKey: prepared.publicKey })) as PublicKeyCredential | null;
  } catch (e: any) {
    // This device already holds a passkey for this account
    if (e?.name === 'InvalidStateError') throw new PasskeyError('Already saved on this device', 'exists');
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') throw new PasskeyError('Cancelled', 'cancelled');
    throw new PasskeyError(e?.message || 'Could not create a passkey', e?.name);
  }
  if (!cred) throw new PasskeyError('Cancelled', 'cancelled');

  const r = cred.response as AuthenticatorAttestationResponse;
  const credential = {
    id: cred.id,
    rawId: cred.id,
    type: 'public-key',
    response: {
      attestationObject: toB64url(r.attestationObject),
      clientDataJSON: toB64url(r.clientDataJSON),
      transports: typeof r.getTransports === 'function' ? r.getTransports() : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: (cred as any).authenticatorAttachment ?? undefined,
  };
  try {
    await call('/passkeys/registration/verify', { challenge_id: prepared.challengeId, credential }, await accessToken());
  } catch (e: any) {
    if (e?.code === 'webauthn_credential_exists') throw new PasskeyError('Already saved', 'exists');
    throw e;
  }
}

export async function listPasskeys(): Promise<Array<{ id: string; friendly_name?: string; created_at: string }>> {
  const data = await call('/passkeys', undefined, await accessToken(), 'GET');
  return Array.isArray(data) ? data : data?.passkeys ?? [];
}

/** True when the error is just the person closing the prompt */
export const isCancel = (e: any) =>
  e?.code === 'cancelled' || e?.name === 'NotAllowedError' || e?.name === 'AbortError';

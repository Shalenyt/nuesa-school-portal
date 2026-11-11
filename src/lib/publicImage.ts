import { supabase } from '@/integrations/supabase/client';

/**
 * Profile photos live in a PRIVATE bucket. Rather than making the whole
 * bucket public, we resolve a signed URL for display.
 *
 * Signed URLs are cached (in memory and for the browser tab) and reused, so a
 * photo is downloaded once and then comes straight from the browser cache.
 * Before this, every avatar asked for a fresh signed URL, which the browser saw
 * as a new image and downloaded again (slow on the voting page and its popup).
 */
const SIGN_SECONDS = 60 * 60 * 6; // 6 hours
const REUSE_MARGIN_MS = 10 * 60 * 1000; // stop reusing 10 minutes before expiry
const STORE_KEY = 'nuesa_signed_images';

type Entry = { url: string; exp: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

try {
  const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') as Record<string, Entry>;
  const now = Date.now();
  Object.entries(saved).forEach(([k, v]) => { if (v?.url && v.exp - REUSE_MARGIN_MS > now) cache.set(k, v); });
} catch { /* storage unavailable */ }

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(cache))); } catch { /* ignore */ }
  }, 300);
}

function pathFor(storedUrl: string, bucket: string) {
  if (!storedUrl.includes(`/${bucket}/`) || storedUrl.includes('/object/sign/')) return null;
  const path = storedUrl.split(`/${bucket}/`).pop()?.split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

function remember(storedUrl: string, url: string) {
  cache.set(storedUrl, { url, exp: Date.now() + SIGN_SECONDS * 1000 });
  persist();
}

function preload(url: string) {
  try { const img = new Image(); img.decoding = 'async'; img.src = url; } catch { /* ignore */ }
}

/** A displayable URL right now, if we already have one (no network) */
export function getCachedImageUrl(storedUrl?: string | null, bucket = 'profile-photos'): string | null {
  if (!storedUrl) return null;
  if (!pathFor(storedUrl, bucket)) return storedUrl;
  const hit = cache.get(storedUrl);
  return hit && hit.exp - REUSE_MARGIN_MS > Date.now() ? hit.url : null;
}

export async function resolveDisplayableImageUrl(
  storedUrl?: string | null,
  bucket = 'profile-photos',
): Promise<string | null> {
  if (!storedUrl) return null;
  const cached = getCachedImageUrl(storedUrl, bucket);
  if (cached) return cached;
  const path = pathFor(storedUrl, bucket);
  if (!path) return storedUrl;

  const pending = inflight.get(storedUrl);
  if (pending) return pending;

  const job = (async () => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_SECONDS);
      if (error || !data?.signedUrl) return storedUrl;
      remember(storedUrl, data.signedUrl);
      return data.signedUrl;
    } catch {
      return storedUrl;
    } finally {
      inflight.delete(storedUrl);
    }
  })();
  inflight.set(storedUrl, job);
  return job;
}

/**
 * Sign many photos in one request and start downloading them, so a list of
 * avatars (and any popup that opens from it) shows instantly.
 */
export async function prefetchImageUrls(storedUrls: (string | null | undefined)[], bucket = 'profile-photos') {
  const wanted = [...new Set(storedUrls.filter(Boolean) as string[])];
  const missing = wanted.filter((u) => pathFor(u, bucket) && !getCachedImageUrl(u, bucket) && !inflight.has(u));
  wanted.forEach((u) => { const c = getCachedImageUrl(u, bucket); if (c) preload(c); });
  if (!missing.length) return;

  const job = (async () => {
    try {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(missing.map((u) => pathFor(u, bucket)!), SIGN_SECONDS);
      (data || []).forEach((row: any, i: number) => {
        if (row?.signedUrl) { remember(missing[i], row.signedUrl); preload(row.signedUrl); }
      });
    } catch { /* fall back to one by one */ }
  })();
  missing.forEach((u) => inflight.set(u, job.then(() => getCachedImageUrl(u, bucket) || u)));
  await job;
  missing.forEach((u) => inflight.delete(u));
}

import { supabase } from '@/integrations/supabase/client';

/**
 * Profile photos live in a PRIVATE bucket. Rather than making the whole
 * bucket public, we resolve a short-lived signed URL for display.
 * Assets already served from a public bucket are returned unchanged.
 */
export async function resolveDisplayableImageUrl(
  storedUrl?: string | null,
  bucket = 'profile-photos',
  expiresInSeconds = 60 * 30,
): Promise<string | null> {
  if (!storedUrl) return null;
  if (!storedUrl.includes(`/${bucket}/`)) return storedUrl;
  if (storedUrl.includes('/object/sign/')) return storedUrl;

  const path = storedUrl.split(`/${bucket}/`).pop()?.split('?')[0];
  if (!path) return storedUrl;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(decodeURIComponent(path), expiresInSeconds);
    if (error || !data?.signedUrl) return storedUrl;
    return data.signedUrl;
  } catch {
    return storedUrl;
  }
}

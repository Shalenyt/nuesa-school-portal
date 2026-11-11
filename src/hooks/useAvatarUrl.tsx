import { useEffect, useState } from 'react';
import { getCachedImageUrl, resolveDisplayableImageUrl } from '@/lib/publicImage';

/**
 * Resolves a stored profile photo URL (private bucket) into a displayable
 * signed URL. Single source of truth for avatars across the whole portal.
 */
export function useAvatarUrl(storedUrl?: string | null) {
  // Start with an already-signed URL when we have one, so cached photos show at once
  const [url, setUrl] = useState<string | null>(() => getCachedImageUrl(storedUrl));

  useEffect(() => {
    let cancelled = false;
    if (!storedUrl) {
      setUrl(null);
      return;
    }
    const cached = getCachedImageUrl(storedUrl);
    if (cached) { setUrl(cached); return; }
    resolveDisplayableImageUrl(storedUrl).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return url;
}

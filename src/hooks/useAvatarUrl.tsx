import { useEffect, useState } from 'react';
import { resolveDisplayableImageUrl } from '@/lib/publicImage';

/**
 * Resolves a stored profile photo URL (private bucket) into a displayable
 * signed URL. Single source of truth for avatars across the whole portal.
 */
export function useAvatarUrl(storedUrl?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!storedUrl) {
      setUrl(null);
      return;
    }
    resolveDisplayableImageUrl(storedUrl).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return url;
}

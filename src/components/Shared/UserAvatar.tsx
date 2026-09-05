import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Central avatar renderer: resolves the stored profile photo into a
 * displayable URL and falls back to initials only when no image exists
 * (or the image genuinely fails to load).
 */
export function UserAvatar({ photoUrl, name, className, fallbackClassName }: UserAvatarProps) {
  const resolved = useAvatarUrl(photoUrl);
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <Avatar className={cn(className)}>
      {resolved && <AvatarImage src={resolved} alt={name ? `Photo of ${name}` : 'Profile photo'} />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Drop-in replacement for <AvatarImage> that resolves private-bucket photos.
 * Renders nothing when there is no image, so the initials fallback shows.
 */
export function SignedAvatarImage({ src, ...props }: { src?: string | null } & Record<string, any>) {
  const resolved = useAvatarUrl(src);
  if (!resolved) return null;
  return <AvatarImage src={resolved} {...props} />;
}

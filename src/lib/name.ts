/** Central helpers so every screen reads names from the same profile record. */

export function firstNameOf(profile: any, fallback = 'there'): string {
  const first = (profile?.first_name || '').trim();
  if (first) return first;
  const fromFull = (profile?.full_name || '').trim().split(/\s+/)[0];
  return fromFull || fallback;
}

/** Official full name: Last First Middle, falling back to the stored full name. */
export function officialFullName(profile: any): string {
  const parts = [profile?.last_name, profile?.first_name, profile?.middle_name]
    .map((p: any) => (p || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  return (profile?.full_name || '').trim();
}

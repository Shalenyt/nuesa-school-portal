import { supabase } from '@/integrations/supabase/client';

export type StaffName = { full_name: string; role: string };

let cache: Promise<Record<string, StaffName>> | null = null;

/**
 * Names and roles of lecturers and admins, readable by any signed-in user.
 * Students and lecturers can't read staff profile rows directly (the
 * database rules hide them), which left "Instructor: Pending" and blank
 * announcement authors. This uses a narrow database function that returns
 * only id, full name and role, so no emails or phone numbers are exposed.
 */
export function getStaffNames(): Promise<Record<string, StaffName>> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await (supabase as any).rpc('get_staff_names');
      if (error || !Array.isArray(data)) {
        cache = null;
        return {};
      }
      const map: Record<string, StaffName> = {};
      for (const row of data) map[row.id] = { full_name: row.full_name, role: row.role };
      return map;
    })();
  }
  return cache;
}

/**
 * Fills `row.profiles` from the staff list wherever the joined profile came
 * back empty. `idKey` is the column holding the staff member's id.
 */
export async function withStaffNames<T extends Record<string, any>>(rows: T[], idKey: string): Promise<T[]> {
  if (!rows.length || rows.every((r) => r?.profiles?.full_name)) return rows;
  const staff = await getStaffNames();
  return rows.map((r) => {
    if (r?.profiles?.full_name) return r;
    const s = r ? staff[r[idKey]] : undefined;
    return s ? { ...r, profiles: { ...(r.profiles || {}), full_name: s.full_name, role: s.role } } : r;
  });
}

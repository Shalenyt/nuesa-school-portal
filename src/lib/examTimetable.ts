import { supabase } from '@/integrations/supabase/client';

/**
 * Entries of the exam timetable students and lecturers should see right now:
 * the published timetable of the current semester, until that semester's
 * vacation date. Drafts and past semesters return nothing (the database
 * policy enforces the same rule).
 */
export async function fetchLiveExamEntries(): Promise<any[]> {
  const { data: semester } = await supabase
    .from('semester_config')
    .select('id, end_date')
    .eq('is_active', true)
    .maybeSingle();
  if (!semester) return [];

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  if (today > semester.end_date) return [];

  const { data: set } = await (supabase as any)
    .from('exam_timetable_sets')
    .select('id')
    .eq('semester_id', semester.id)
    .eq('status', 'published')
    .maybeSingle();
  if (!set) return [];

  const { data } = await (supabase as any)
    .from('exam_timetables')
    .select('*')
    .eq('set_id', set.id)
    .order('exam_date')
    .order('time_slot');
  return data || [];
}

import { supabase } from '@/integrations/supabase/client';

/**
 * Send notifications to all students enrolled in a course.
 */
export async function notifyEnrolledStudents(
  courseId: string,
  title: string,
  message: string,
  type: string,
  relatedId?: string
) {
  // Get all enrolled students for this course
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('course_id', courseId);

  if (!enrollments?.length) return;

  const notifications = enrollments.map((e) => ({
    user_id: e.student_id,
    title,
    message,
    type,
    related_id: relatedId || null,
    is_read: false,
  }));

  await supabase.from('notifications').insert(notifications);
}

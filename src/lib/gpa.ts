import { supabase } from '@/integrations/supabase/client';

export function scoreToGrade(pct: number): { point: number; letter: string } {
  if (pct >= 70) return { point: 5, letter: 'A' };
  if (pct >= 60) return { point: 4, letter: 'B' };
  if (pct >= 50) return { point: 3, letter: 'C' };
  if (pct >= 45) return { point: 2, letter: 'D' };
  if (pct >= 40) return { point: 1, letter: 'E' };
  return { point: 0, letter: 'F' };
}

export interface CourseGrade {
  courseId: string;
  courseName: string;
  creditUnit: number;
  score: number;
  gradePoint: number;
  letterGrade: string;
}

export interface GPAResult {
  gpa: number;
  courseGrades: CourseGrade[];
  totalCredits: number;
  totalQualityPoints: number;
}

/**
 * Centralized GPA calculation - single source of truth for all dashboards.
 * Uses weighted credit unit system on a 5.0 scale.
 */
export async function calculateStudentGPA(studentId: string): Promise<GPAResult> {
  const [{ data: assignmentSubs }, { data: quizSubs }] = await Promise.all([
    supabase
      .from('assignment_submissions')
      .select('grade, assignments(max_points, course_id, results_released, courses(id, name, credit_unit, subjects(name)))')
      .eq('student_id', studentId)
      .not('grade', 'is', null),
    (supabase as any)
      .from('quiz_submissions')
      .select('score, quizzes(max_points, course_id, results_released, courses(id, name, credit_unit, subjects(name)))')
      .eq('student_id', studentId)
      .not('score', 'is', null),
  ]);

  const courseMap = new Map<string, { scores: number[]; maxScores: number[]; name: string; credit: number }>();

  (assignmentSubs || []).forEach((s: any) => {
    const c = s.assignments?.courses;
    if (!c || !s.assignments?.results_released) return;
    const courseId = c.id || s.assignments.course_id;
    const existing = courseMap.get(courseId) || { scores: [], maxScores: [], name: c.name || c.subjects?.name, credit: c.credit_unit || 1 };
    existing.scores.push(s.grade);
    existing.maxScores.push(s.assignments.max_points || 100);
    courseMap.set(courseId, existing);
  });

  (quizSubs || []).forEach((s: any) => {
    const c = s.quizzes?.courses;
    if (!c || !s.quizzes?.results_released) return;
    const courseId = c.id || s.quizzes.course_id;
    const existing = courseMap.get(courseId) || { scores: [], maxScores: [], name: c.name || c.subjects?.name, credit: c.credit_unit || 1 };
    existing.scores.push(s.score);
    existing.maxScores.push(s.quizzes.max_points || 100);
    courseMap.set(courseId, existing);
  });

  const courseGrades: CourseGrade[] = [];
  let totalPoints = 0;
  let totalCredits = 0;

  courseMap.forEach((data, courseId) => {
    const totalScore = data.scores.reduce((a, b) => a + b, 0);
    const totalMax = data.maxScores.reduce((a, b) => a + b, 0);
    const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const { point, letter } = scoreToGrade(pct);

    courseGrades.push({
      courseId,
      courseName: data.name,
      creditUnit: data.credit,
      score: Math.round(pct),
      gradePoint: point,
      letterGrade: letter,
    });

    totalPoints += point * data.credit;
    totalCredits += data.credit;
  });

  const gpa = totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;

  return { gpa, courseGrades, totalCredits, totalQualityPoints: totalPoints };
}

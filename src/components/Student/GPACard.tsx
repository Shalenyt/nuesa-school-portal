import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

interface CourseGrade {
  courseName: string;
  creditUnit: number;
  score: number;
  gradePoint: number;
  letterGrade: string;
}

function scoreToGrade(pct: number): { point: number; letter: string } {
  if (pct >= 70) return { point: 5, letter: 'A' };
  if (pct >= 60) return { point: 4, letter: 'B' };
  if (pct >= 50) return { point: 3, letter: 'C' };
  if (pct >= 45) return { point: 2, letter: 'D' };
  if (pct >= 40) return { point: 1, letter: 'E' };
  return { point: 0, letter: 'F' };
}

export function GPACard() {
  const { profile } = useAuth();
  const [courseGrades, setCourseGrades] = useState<CourseGrade[]>([]);
  const [gpa, setGpa] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchGrades();
  }, [profile]);

  const fetchGrades = async () => {
    try {
      // Get assignment grades
      const { data: assignmentSubs } = await supabase
        .from('assignment_submissions')
        .select('grade, assignments(max_points, course_id, courses(name, credit_unit, subjects(name)))')
        .eq('student_id', profile!.id)
        .not('grade', 'is', null);

      // Get quiz grades
      const { data: quizSubs } = await (supabase as any)
        .from('quiz_submissions')
        .select('score, quizzes(max_points, course_id, courses(name, credit_unit, subjects(name)))')
        .eq('student_id', profile!.id)
        .not('score', 'is', null);

      // Aggregate scores per course
      const courseMap = new Map<string, { scores: number[]; maxScores: number[]; name: string; credit: number }>();

      (assignmentSubs || []).forEach((s: any) => {
        const c = s.assignments?.courses;
        if (!c) return;
        const courseId = s.assignments.course_id;
        const existing = courseMap.get(courseId) || { scores: [], maxScores: [], name: c.name || c.subjects?.name, credit: c.credit_unit || 1 };
        existing.scores.push(s.grade);
        existing.maxScores.push(s.assignments.max_points || 100);
        courseMap.set(courseId, existing);
      });

      (quizSubs || []).forEach((s: any) => {
        const c = s.quizzes?.courses;
        if (!c) return;
        const courseId = s.quizzes.course_id;
        const existing = courseMap.get(courseId) || { scores: [], maxScores: [], name: c.name || c.subjects?.name, credit: c.credit_unit || 1 };
        existing.scores.push(s.score);
        existing.maxScores.push(s.quizzes.max_points || 100);
        courseMap.set(courseId, existing);
      });

      const grades: CourseGrade[] = [];
      let totalPoints = 0;
      let totalCredits = 0;

      courseMap.forEach((data) => {
        const totalScore = data.scores.reduce((a, b) => a + b, 0);
        const totalMax = data.maxScores.reduce((a, b) => a + b, 0);
        const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        const { point, letter } = scoreToGrade(pct);

        grades.push({
          courseName: data.name,
          creditUnit: data.credit,
          score: Math.round(pct),
          gradePoint: point,
          letterGrade: letter,
        });

        totalPoints += point * data.credit;
        totalCredits += data.credit;
      });

      setCourseGrades(grades);
      setGpa(totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0);
    } catch (err) {
      console.error('Error calculating GPA:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGpaColor = (gpa: number) => {
    if (gpa >= 4.5) return 'text-green-600';
    if (gpa >= 3.5) return 'text-blue-600';
    if (gpa >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) return null;
  if (courseGrades.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          GPA Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current GPA</p>
            <p className={`text-3xl font-bold ${getGpaColor(gpa)}`}>{gpa.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Courses</p>
            <p className="text-xl font-semibold">{courseGrades.length}</p>
          </div>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {courseGrades.map((g, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
              <span className="truncate flex-1">{g.courseName}</span>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="outline" className="text-xs">{g.creditUnit} CU</Badge>
                <Badge variant={g.gradePoint >= 3 ? 'default' : 'destructive'} className="min-w-[28px] justify-center">
                  {g.letterGrade}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

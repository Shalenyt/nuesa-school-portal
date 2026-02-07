import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Trophy, Calendar, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';

export default function StudentViewResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Get user profile to check department and level
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('department_id, level_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.department_id || !profile?.level_id) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Get courses from course lists based on student's department and level
      const { data: courseListData } = await supabase
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      if (!courseListData?.course_ids || courseListData.course_ids.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Get assignment submissions for those courses
      const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select(`
          grade,
          feedback,
          graded_at,
          submitted_at,
          assignments!inner(
            title,
            max_points,
            course_id,
            courses(
              name,
              subjects(name)
            )
          )
        `)
        .eq('student_id', userId)
        .in('assignments.course_id', courseListData.course_ids)
        .not('grade', 'is', null);

      setResults(submissions || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: number, maxPoints: number) => {
    const percentage = (grade / maxPoints) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 70) return 'bg-blue-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getGradeStatus = (grade: number, maxPoints: number) => {
    const percentage = (grade / maxPoints) * 100;
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Satisfactory';
    return 'Needs Improvement';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
          <p className="text-muted-foreground">
            View your assignment grades and feedback
          </p>
        </div>

        {loading ? (
          <div className="text-center">Loading results...</div>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No results available</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please update your department and level in your profile, or no results are available yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {result.assignments.title}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        <BookOpen className="h-4 w-4 inline mr-1" />
                        {result.assignments.courses.name} - {result.assignments.courses.subjects?.name}
                      </div>
                    </div>
                    <Badge 
                      className={`${getGradeColor(result.grade, result.assignments.max_points)} text-primary-foreground`}
                    >
                      {result.grade}/{result.assignments.max_points}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Score</label>
                      <p className="text-lg font-semibold">
                        {result.grade}/{result.assignments.max_points}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Percentage</label>
                      <p className="text-lg font-semibold">
                        {((result.grade / result.assignments.max_points) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-lg font-semibold">
                        {getGradeStatus(result.grade, result.assignments.max_points)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Graded</label>
                      <p className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(result.graded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {result.feedback && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Feedback</label>
                      <div className="mt-1 p-3 bg-secondary rounded-lg">
                        <p className="text-sm">{result.feedback}</p>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Submitted: {new Date(result.submitted_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
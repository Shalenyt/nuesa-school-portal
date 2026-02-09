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
      if (!userId) { setLoading(false); return; }

      // Fetch all graded submissions for the student directly
      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select(`
          id, grade, feedback, graded_at, submitted_at,
          assignments(title, max_points, course_id, courses(name, subjects(name)))
        `)
        .eq('student_id', userId)
        .not('grade', 'is', null)
        .order('graded_at', { ascending: false });

      if (error) {
        console.error('Error fetching results:', error);
      }

      setResults(submissions || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: number, maxPoints: number) => {
    const pct = (grade / maxPoints) * 100;
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 70) return 'bg-blue-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getGradeStatus = (grade: number, maxPoints: number) => {
    const pct = (grade / maxPoints) * 100;
    if (pct >= 80) return 'Excellent';
    if (pct >= 70) return 'Good';
    if (pct >= 60) return 'Satisfactory';
    return 'Needs Improvement';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
          <p className="text-muted-foreground">View your assignment grades and feedback</p>
        </div>

        {loading ? (
          <div className="text-center">Loading results...</div>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No results available</h3>
                <p className="mt-1 text-sm text-muted-foreground">No graded assignments yet.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {results.map((result) => {
              const assignment = (result as any).assignments;
              const maxPts = assignment?.max_points || 100;
              const courseName = assignment?.courses?.name || assignment?.courses?.subjects?.name || 'Unknown';
              return (
                <Card key={result.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {assignment?.title}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          <BookOpen className="h-4 w-4 inline mr-1" />
                          {courseName}
                        </div>
                      </div>
                      <Badge className={`${getGradeColor(result.grade, maxPts)} text-white`}>
                        {result.grade}/{maxPts}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Score</label>
                        <p className="text-lg font-semibold">{result.grade}/{maxPts}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Percentage</label>
                        <p className="text-lg font-semibold">{((result.grade / maxPts) * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <p className="text-lg font-semibold">{getGradeStatus(result.grade, maxPts)}</p>
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
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

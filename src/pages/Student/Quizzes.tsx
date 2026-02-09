import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import { QuizAttempt } from '@/components/Student/QuizAttempt';

export default function StudentQuizzes() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'attempt'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    // Published quizzes for enrolled courses
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('course_id')
      .eq('student_id', profile?.id);

    if (!enrollments?.length) { setLoading(false); return; }
    const courseIds = enrollments.map(e => e.course_id);

    const [{ data: quizzesData }, { data: subsData }] = await Promise.all([
      (supabase as any).from('quizzes').select('*, courses(name, subjects(name))').in('course_id', courseIds).in('status', ['published', 'closed']).order('created_at', { ascending: false }),
      (supabase as any).from('quiz_submissions').select('*, quizzes(title, max_points, courses(name))').eq('student_id', profile?.id).order('submitted_at', { ascending: false })
    ]);

    setQuizzes(quizzesData || []);
    setMySubmissions(subsData || []);
    setLoading(false);
  };

  const startQuiz = async (quiz: any) => {
    // Check if already submitted
    const existing = mySubmissions.find(s => s.quiz_id === quiz.id);
    if (existing) {
      toast({ title: 'Already submitted', description: 'You have already taken this quiz.', variant: 'destructive' });
      return;
    }

    const { data } = await (supabase as any)
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('sort_order', { ascending: true });

    setSelectedQuiz(quiz);
    setQuestions(data || []);
    setAnswers({});
    setView('attempt');
  };

  const submitQuiz = async () => {
    if (!selectedQuiz) return;
    setSubmitting(true);

    const { error } = await (supabase as any)
      .from('quiz_submissions')
      .insert({
        quiz_id: selectedQuiz.id,
        student_id: profile?.id,
        answers: answers
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quiz submitted successfully!' });
      setView('list');
      fetchData();
    }
    setSubmitting(false);
  };

  if (loading) return <DashboardLayout><div className="text-center">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <Button variant="outline" size="sm" onClick={() => setView('list')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-muted-foreground">Take quizzes and view your results</p>
          </div>
        </div>

        {view === 'list' && (
          <Tabs defaultValue="available" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="available">Available Quizzes</TabsTrigger>
              <TabsTrigger value="results">My Results</TabsTrigger>
            </TabsList>

            <TabsContent value="available">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quizzes.filter(q => q.status === 'published' && !mySubmissions.find(s => s.quiz_id === q.id)).map((q) => (
                  <Card key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => startQuiz(q)}>
                    <CardHeader>
                      <CardTitle className="text-base">{q.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{q.courses?.name || q.courses?.subjects?.name}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Badge variant="outline">{q.max_points} pts</Badge>
                        {q.duration_minutes && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{q.duration_minutes} min</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {quizzes.filter(q => q.status === 'published' && !mySubmissions.find(s => s.quiz_id === q.id)).length === 0 && (
                  <Card><CardContent className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No available quizzes.</p>
                  </CardContent></Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="results">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mySubmissions.map((s) => (
                  <Card key={s.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{s.quizzes?.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{s.quizzes?.courses?.name}</p>
                    </CardHeader>
                    <CardContent>
                      {s.score !== null ? (
                        <Badge variant="default">{s.score}/{s.quizzes?.max_points || 100}</Badge>
                      ) : (
                        <Badge variant="secondary">Awaiting grading</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {mySubmissions.length === 0 && (
                  <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No quiz submissions yet.</p></CardContent></Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {view === 'attempt' && selectedQuiz && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedQuiz.title}</CardTitle>
              {selectedQuiz.description && <p className="text-sm text-muted-foreground">{selectedQuiz.description}</p>}
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-3 p-4 border rounded-lg">
                  <p className="font-medium">
                    {idx + 1}. {q.question_text}
                    <span className="text-sm text-muted-foreground ml-2">({q.points} pt{q.points > 1 ? 's' : ''})</span>
                  </p>
                  <div className="space-y-2">
                    {(q.options as string[]).map((opt: string, oIdx: number) => (
                      <label key={oIdx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === oIdx ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id] === oIdx}
                          onChange={() => setAnswers({ ...answers, [q.id]: oIdx })}
                          className="accent-primary"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <Button onClick={submitQuiz} disabled={submitting} className="w-full">
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

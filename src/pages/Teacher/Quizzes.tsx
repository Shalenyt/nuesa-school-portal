import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { notifyEnrolledStudents } from '@/lib/notifications';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, CheckCircle, ArrowLeft, BookOpen } from 'lucide-react';

interface QuestionForm {
  question_text: string;
  options: string[];
  correct_answer: number;
  points: number;
}

export default function TeacherQuizzes() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'submissions' | 'grade'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeValue, setGradeValue] = useState('');
  const [loading, setLoading] = useState(true);

  // Create quiz form
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    course_id: '',
    duration_minutes: '',
    max_points: '100'
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 1 }
  ]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    const [{ data: coursesData }, { data: quizzesData }] = await Promise.all([
      supabase.from('courses').select('id, name, subjects(name, code), classes(name)').eq('teacher_id', profile?.id),
      (supabase as any).from('quizzes').select('*, courses(name, subjects(name))').eq('created_by', profile?.id).order('created_at', { ascending: false })
    ]);
    setCourses(coursesData || []);
    setQuizzes(quizzesData || []);
    setLoading(false);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 1 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[idx] as any)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const createQuiz = async () => {
    if (!quizForm.title || !quizForm.course_id || questions.length === 0) {
      toast({ title: 'Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    const { data: quiz, error } = await (supabase as any)
      .from('quizzes')
      .insert({
        title: quizForm.title,
        description: quizForm.description,
        course_id: quizForm.course_id,
        created_by: profile?.id,
        duration_minutes: quizForm.duration_minutes ? parseInt(quizForm.duration_minutes) : null,
        max_points: parseInt(quizForm.max_points) || 100,
        status: 'published'
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Insert questions
    const questionsToInsert = questions.map((q, i) => ({
      quiz_id: quiz.id,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      sort_order: i
    }));

    const { error: qError } = await (supabase as any).from('quiz_questions').insert(questionsToInsert);
    if (qError) {
      toast({ title: 'Error', description: qError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Quiz created and published!' });
    // Notify enrolled students
    await notifyEnrolledStudents(quizForm.course_id, 'New Quiz Available', `A new quiz "${quizForm.title}" has been published. Take it now!`, 'quiz', quiz.id);
    setView('list');
    setQuizForm({ title: '', description: '', course_id: '', duration_minutes: '', max_points: '100' });
    setQuestions([{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 1 }]);
    fetchData();
  };

  const viewSubmissions = async (quiz: any) => {
    setSelectedQuiz(quiz);
    const { data } = await (supabase as any)
      .from('quiz_submissions')
      .select('*, profiles!quiz_submissions_student_id_fkey(full_name, student_id)')
      .eq('quiz_id', quiz.id)
      .order('submitted_at', { ascending: false });
    setSubmissions(data || []);
    setView('submissions');
  };

  const gradeSubmission = async () => {
    if (!selectedSubmission || !gradeValue) return;
    const { error } = await (supabase as any)
      .from('quiz_submissions')
      .update({ score: parseInt(gradeValue), graded_at: new Date().toISOString(), graded_by: profile?.id })
      .eq('id', selectedSubmission.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quiz graded!' });
      // Notify the student about their grade
      await supabase.from('notifications').insert({
        user_id: selectedSubmission.student_id,
        title: 'Quiz Graded',
        message: `Your quiz "${selectedQuiz?.title}" has been graded. Score: ${gradeValue}/${selectedQuiz?.max_points || 100}`,
        type: 'grade',
        related_id: selectedSubmission.quiz_id,
      });
      setView('submissions');
      setSelectedSubmission(null);
      setGradeValue('');
      viewSubmissions(selectedQuiz);
    }
  };

  const toggleQuizStatus = async (quiz: any) => {
    const newStatus = quiz.status === 'published' ? 'closed' : 'published';
    await (supabase as any).from('quizzes').update({ status: newStatus }).eq('id', quiz.id);
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <Button variant="outline" size="sm" onClick={() => { setView('list'); setSelectedQuiz(null); setSelectedSubmission(null); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-muted-foreground">Create and manage quizzes for your courses</p>
          </div>
          {view === 'list' && (
            <Button className="ml-auto" onClick={() => setView('create')}>
              <Plus className="h-4 w-4 mr-2" /> Create Quiz
            </Button>
          )}
        </div>

        {view === 'list' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {q.title}
                    <Badge variant={q.status === 'published' ? 'default' : 'secondary'}>{q.status}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{q.courses?.name || q.courses?.subjects?.name}</p>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewSubmissions(q)}>
                    <Eye className="h-4 w-4 mr-1" /> Submissions
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleQuizStatus(q)}>
                    {q.status === 'published' ? 'Close' : 'Reopen'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {quizzes.length === 0 && !loading && (
              <Card><CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quizzes yet. Create one to get started.</p>
              </CardContent></Card>
            )}
          </div>
        )}

        {view === 'create' && (
          <Card>
            <CardHeader><CardTitle>Create New Quiz</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} placeholder="Quiz title" />
                </div>
                <div className="space-y-2">
                  <Label>Course *</Label>
                  <Select value={quizForm.course_id} onValueChange={(v) => setQuizForm({ ...quizForm, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name || c.subjects?.name} ({c.classes?.name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes, optional)</Label>
                  <Input type="number" value={quizForm.duration_minutes} onChange={(e) => setQuizForm({ ...quizForm, duration_minutes: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Points</Label>
                  <Input type="number" value={quizForm.max_points} onChange={(e) => setQuizForm({ ...quizForm, max_points: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Questions</h3>
                  <Button variant="outline" size="sm" onClick={addQuestion}><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
                </div>
                {questions.map((q, qIdx) => (
                  <Card key={qIdx} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Question {qIdx + 1}</Label>
                      {questions.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIdx)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                    <Input value={q.question_text} onChange={(e) => updateQuestion(qIdx, 'question_text', e.target.value)} placeholder="Enter question" />
                    <div className="grid gap-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correct_answer === oIdx}
                            onChange={() => updateQuestion(qIdx, 'correct_answer', oIdx)}
                            className="accent-primary"
                          />
                          <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Points:</Label>
                      <Input type="number" className="w-20" value={q.points} onChange={(e) => updateQuestion(qIdx, 'points', parseInt(e.target.value) || 1)} />
                    </div>
                  </Card>
                ))}
              </div>

              <Button onClick={createQuiz} className="w-full">Create & Publish Quiz</Button>
            </CardContent>
          </Card>
        )}

        {view === 'submissions' && (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="graded">Graded</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {submissions.filter(s => s.score === null).map((s) => (
                  <Card key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSubmission(s); setView('grade'); }}>
                    <CardHeader>
                      <CardTitle className="text-base">{s.profiles?.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">ID: {s.profiles?.student_id}</p>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">Not graded</Badge>
                    </CardContent>
                  </Card>
                ))}
                {submissions.filter(s => s.score === null).length === 0 && (
                  <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No pending submissions.</p></CardContent></Card>
                )}
              </div>
            </TabsContent>
            <TabsContent value="graded">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {submissions.filter(s => s.score !== null).map((s) => (
                  <Card key={s.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{s.profiles?.full_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge>{s.score}/{selectedQuiz?.max_points || 100}</Badge>
                    </CardContent>
                  </Card>
                ))}
                {submissions.filter(s => s.score !== null).length === 0 && (
                  <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No graded submissions.</p></CardContent></Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {view === 'grade' && selectedSubmission && (
          <Card>
            <CardHeader><CardTitle>Grade Submission</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p><strong>Student:</strong> {selectedSubmission.profiles?.full_name}</p>
              <p><strong>Answers:</strong></p>
              <pre className="bg-muted p-4 rounded text-sm overflow-auto">{JSON.stringify(selectedSubmission.answers, null, 2)}</pre>
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>Score (0-{selectedQuiz?.max_points || 100})</Label>
                  <Input type="number" value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} max={selectedQuiz?.max_points || 100} />
                </div>
                <Button onClick={gradeSubmission} className="mt-6">
                  <CheckCircle className="h-4 w-4 mr-2" /> Submit Grade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

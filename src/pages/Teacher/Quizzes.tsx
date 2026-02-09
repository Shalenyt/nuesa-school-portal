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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, CheckCircle, ArrowLeft, BookOpen, Send } from 'lucide-react';

interface QuestionForm {
  question_text: string;
  options: string[];
  correct_answer: number;
  points: number;
}

export default function LecturerQuizzes() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'submissions' | 'grade'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishingSubmissionIds, setPublishingSubmissionIds] = useState<string[]>([]);

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

    // Validate all questions have text and at least 2 options filled
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question_text.trim()) {
        toast({ title: 'Error', description: `Question ${i + 1} is empty.`, variant: 'destructive' });
        return;
      }
      const filledOptions = questions[i].options.filter(o => o.trim());
      if (filledOptions.length < 2) {
        toast({ title: 'Error', description: `Question ${i + 1} needs at least 2 options.`, variant: 'destructive' });
        return;
      }
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
    await notifyEnrolledStudents(quizForm.course_id, 'New Quiz Available', `A new quiz "${quizForm.title}" has been published. Take it now!`, 'quiz', quiz.id);
    setView('list');
    setQuizForm({ title: '', description: '', course_id: '', duration_minutes: '', max_points: '100' });
    setQuestions([{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 1 }]);
    fetchData();
  };

  const viewSubmissions = async (quiz: any) => {
    setSelectedQuiz(quiz);
    const [{ data: subsData }, { data: questionsData }] = await Promise.all([
      (supabase as any)
        .from('quiz_submissions')
        .select('*, profiles!quiz_submissions_student_id_fkey(full_name, student_id)')
        .eq('quiz_id', quiz.id)
        .order('submitted_at', { ascending: false }),
      (supabase as any)
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })
    ]);
    setSubmissions(subsData || []);
    setQuizQuestions(questionsData || []);
    setView('submissions');
  };

  // Auto-grade a submission based on correct answers
  const autoGrade = (submission: any) => {
    if (!quizQuestions.length) return 0;
    const answers = submission.answers || {};
    let score = 0;
    quizQuestions.forEach((q: any) => {
      if (answers[q.id] === q.correct_answer) {
        score += q.points;
      }
    });
    return score;
  };

  // Auto-grade and save for a single submission
  const gradeAndSave = async (submission: any) => {
    const score = autoGrade(submission);
    const { error } = await (supabase as any)
      .from('quiz_submissions')
      .update({ score, graded_at: new Date().toISOString(), graded_by: profile?.id })
      .eq('id', submission.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Notify student
    await supabase.from('notifications').insert({
      user_id: submission.student_id,
      title: 'Quiz Graded',
      message: `Your quiz "${selectedQuiz?.title}" has been graded. Score: ${score}/${selectedQuiz?.max_points || 100}`,
      type: 'grade',
      related_id: submission.quiz_id,
    });
  };

  // Auto-grade all pending submissions
  const autoGradeAll = async () => {
    const pending = submissions.filter(s => s.score === null);
    if (pending.length === 0) {
      toast({ title: 'Info', description: 'No pending submissions to grade.' });
      return;
    }

    for (const sub of pending) {
      await gradeAndSave(sub);
    }

    toast({ title: 'Success', description: `Auto-graded ${pending.length} submissions!` });
    viewSubmissions(selectedQuiz);
  };

  // Publish scores to students (notify them)
  const publishScores = async () => {
    const graded = submissions.filter(s => s.score !== null);
    if (graded.length === 0) {
      toast({ title: 'Info', description: 'No graded submissions to publish.' });
      return;
    }

    setPublishingSubmissionIds(graded.map(s => s.id));

    for (const sub of graded) {
      await supabase.from('notifications').insert({
        user_id: sub.student_id,
        title: 'Quiz Score Published',
        message: `Your score for "${selectedQuiz?.title}" is ${sub.score}/${selectedQuiz?.max_points || 100}. Check your results!`,
        type: 'grade',
        related_id: sub.quiz_id,
      });
    }

    toast({ title: 'Success', description: `Published scores for ${graded.length} students!` });
    setPublishDialogOpen(false);
    setPublishingSubmissionIds([]);
  };

  const toggleQuizStatus = async (quiz: any) => {
    const newStatus = quiz.status === 'published' ? 'closed' : 'published';
    await (supabase as any).from('quizzes').update({ status: newStatus }).eq('id', quiz.id);
    fetchData();
  };

  // Render student answers with actual text
  const renderStudentAnswers = (submission: any) => {
    if (!quizQuestions.length) return <p className="text-muted-foreground">No questions found.</p>;
    const answers = submission.answers || {};
    let totalScore = 0;

    return (
      <div className="space-y-4">
        {quizQuestions.map((q: any, idx: number) => {
          const studentAnswerIdx = answers[q.id];
          const studentAnswer = studentAnswerIdx !== undefined && q.options?.[studentAnswerIdx] 
            ? q.options[studentAnswerIdx] 
            : 'Not answered';
          const correctAnswer = q.options?.[q.correct_answer] || 'N/A';
          const isCorrect = studentAnswerIdx === q.correct_answer;
          if (isCorrect) totalScore += q.points;

          return (
            <div key={q.id} className="p-4 border rounded-lg space-y-2">
              <p className="font-medium">{idx + 1}. {q.question_text} <span className="text-sm text-muted-foreground">({q.points} pt{q.points > 1 ? 's' : ''})</span></p>
              <div className="grid gap-1 text-sm">
                <p className={isCorrect ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                  Student's Answer: {studentAnswer} {isCorrect ? '✓' : '✗'}
                </p>
                {!isCorrect && (
                  <p className="text-green-600">Correct Answer: {correctAnswer}</p>
                )}
              </div>
            </div>
          );
        })}
        <div className="p-4 bg-muted rounded-lg">
          <p className="font-bold text-lg">Auto-calculated Score: {totalScore}/{selectedQuiz?.max_points || 100}</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          {view !== 'list' && (
            <Button variant="outline" size="sm" onClick={() => { setView('list'); setSelectedQuiz(null); setSelectedSubmission(null); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-muted-foreground text-sm">Create and manage quizzes for your courses</p>
          </div>
          {view === 'list' && (
            <Button className="ml-auto" onClick={() => setView('create')}>
              <Plus className="h-4 w-4 mr-2" /> Create Quiz
            </Button>
          )}
        </div>

        {view === 'list' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                    <span className="truncate">{q.title}</span>
                    <Badge variant={q.status === 'published' ? 'default' : 'secondary'}>{q.status}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{q.courses?.name || q.courses?.subjects?.name}</p>
                </CardHeader>
                <CardContent className="flex gap-2 flex-wrap">
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="flex items-center justify-between flex-wrap gap-2">
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
                      <Label className="text-sm text-muted-foreground">Options (select the correct answer):</Label>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correct_answer === oIdx}
                            onChange={() => updateQuestion(qIdx, 'correct_answer', oIdx)}
                            className="accent-primary"
                            title={`Mark option ${oIdx + 1} as correct`}
                          />
                          <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} />
                          {q.correct_answer === oIdx && (
                            <Badge variant="default" className="shrink-0 text-xs">✓ Correct</Badge>
                          )}
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
          <>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={autoGradeAll} variant="default">
                <CheckCircle className="h-4 w-4 mr-2" /> Auto-Grade All
              </Button>
              <Button onClick={() => setPublishDialogOpen(true)} variant="outline">
                <Send className="h-4 w-4 mr-2" /> Publish Scores to Students
              </Button>
            </div>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">Pending ({submissions.filter(s => s.score === null).length})</TabsTrigger>
                <TabsTrigger value="graded">Graded ({submissions.filter(s => s.score !== null).length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {submissions.filter(s => s.score === null).map((s) => (
                    <Card key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSubmission(s); setView('grade'); }}>
                      <CardHeader>
                        <CardTitle className="text-base">{s.profiles?.full_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">Matric NO: {s.profiles?.student_id}</p>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between">
                        <Badge variant="secondary">Not graded</Badge>
                        <span className="text-sm text-muted-foreground">Auto: {autoGrade(s)} pts</span>
                      </CardContent>
                    </Card>
                  ))}
                  {submissions.filter(s => s.score === null).length === 0 && (
                    <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No pending submissions.</p></CardContent></Card>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="graded">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {submissions.filter(s => s.score !== null).map((s) => (
                    <Card key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSubmission(s); setView('grade'); }}>
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

            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish Scores</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  This will notify all {submissions.filter(s => s.score !== null).length} graded students with their scores for "{selectedQuiz?.title}".
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
                  <Button onClick={publishScores}>
                    <Send className="h-4 w-4 mr-2" /> Publish
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {view === 'grade' && selectedSubmission && (
          <Card>
            <CardHeader><CardTitle>Submission Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p><strong>Student:</strong> {selectedSubmission.profiles?.full_name}</p>
              <p><strong>Matric NO:</strong> {selectedSubmission.profiles?.student_id}</p>
              {renderStudentAnswers(selectedSubmission)}
              {selectedSubmission.score === null && (
                <Button onClick={async () => {
                  await gradeAndSave(selectedSubmission);
                  toast({ title: 'Graded!', description: `Score: ${autoGrade(selectedSubmission)}/${selectedQuiz?.max_points || 100}` });
                  viewSubmissions(selectedQuiz);
                }}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Auto-Grade This Submission
                </Button>
              )}
              {selectedSubmission.score !== null && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold">Saved Score: {selectedSubmission.score}/{selectedQuiz?.max_points || 100}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';

interface HardQuestion {
  questionText: string;
  quizTitle: string;
  failRate: number;
}

export function HardestQuestions() {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<HardQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const { data: quizzes } = await (supabase as any)
        .from('quizzes')
        .select('id, title')
        .eq('created_by', profile!.id);

      if (!quizzes?.length) { setLoading(false); return; }

      const hardQuestions: HardQuestion[] = [];

      for (const quiz of quizzes.slice(0, 5)) {
        const [{ data: qData }, { data: subs }] = await Promise.all([
          (supabase as any).from('quiz_questions').select('id, question_text, correct_answer').eq('quiz_id', quiz.id),
          (supabase as any).from('quiz_submissions').select('answers').eq('quiz_id', quiz.id),
        ]);

        if (!qData?.length || !subs?.length) continue;

        for (const q of qData) {
          const wrong = subs.filter((s: any) => s.answers?.[q.id] !== q.correct_answer).length;
          const failRate = Math.round((wrong / subs.length) * 100);
          hardQuestions.push({ questionText: q.question_text, quizTitle: quiz.title, failRate });
        }
      }

      hardQuestions.sort((a, b) => b.failRate - a.failRate);
      setQuestions(hardQuestions.slice(0, 5));
    } catch (err) {
      console.error('Error fetching hardest questions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show the card with a message instead of hiding it, so the page isn't blank
  if (loading || questions.length === 0) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-start gap-2 leading-tight">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Hardest Questions (Most Failed)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : 'No answers yet. The questions students miss most will show here after your quizzes are taken.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    // min-w-0 stops long question text from stretching the card past the screen on phones
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-start gap-2 leading-tight">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Hardest Questions (Most Failed)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{q.questionText}</span>
              <span className="shrink-0 whitespace-nowrap text-destructive font-medium">{q.failRate}% failed</span>
            </div>
            <Progress value={q.failRate} className="h-2 [&>div]:bg-destructive" />
            <p className="text-xs text-muted-foreground">{q.quizTitle}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, Clock, AlertTriangle, Shield, Maximize } from 'lucide-react';
import { useAntiCheat } from '@/hooks/useAntiCheat';

interface QuizAttemptProps {
  quiz: any;
  questions: any[];
  onSubmit: (answers: Record<string, number>, deviceInfo?: any) => Promise<void>;
  studentId: string;
}

export function QuizAttempt({ quiz, questions, onSubmit, studentId }: QuizAttemptProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.duration_minutes ? quiz.duration_minutes * 60 : null
  );
  const hasAutoSubmitted = useRef(false);

  // Randomize question order per student (seeded by student+quiz id)
  const [randomizedQuestions] = useState(() => {
    const seed = (studentId + quiz.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (seed * (i + 1)) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const doSubmit = useCallback(async () => {
    if (submitting || hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;
    setSubmitting(true);
    setConfirmOpen(false);
    await onSubmit(answers, antiCheat.getDeviceFingerprint());
    setSubmitting(false);
  }, [answers, onSubmit, submitting]);

  const antiCheat = useAntiCheat({
    quizId: quiz.id,
    studentId,
    maxViolations: 3,
    onAutoSubmit: () => {
      doSubmit();
    },
  });

  // Request fullscreen on start
  useEffect(() => {
    if (quiz.duration_minutes) {
      antiCheat.requestFullscreen();
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      doSubmit();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, doSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = randomizedQuestions.length;
  const unansweredCount = totalQuestions - answeredCount;

  const totalSeconds = quiz.duration_minutes ? quiz.duration_minutes * 60 : 0;
  const progressPercent = totalSeconds > 0 && timeLeft !== null ? (timeLeft / totalSeconds) * 100 : 100;
  const isUrgent = timeLeft !== null && timeLeft <= 60;
  const isWarning = timeLeft !== null && timeLeft <= totalSeconds * 0.25 && !isUrgent;

  return (
    <>
      {/* Anti-cheat warning overlay */}
      {antiCheat.warningMessage && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-semibold text-destructive">{antiCheat.warningMessage}</p>
              <div className="flex gap-2 justify-center">
                {antiCheat.warningMessage.includes('auto-submitted') ? (
                  <p className="text-sm text-muted-foreground">Your quiz has been submitted.</p>
                ) : (
                  <Button onClick={() => { antiCheat.dismissWarning(); antiCheat.requestFullscreen(); }}>
                    Okay, Return to Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg sm:text-xl">{quiz.title}</CardTitle>
              {quiz.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Anti-cheat indicator */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${
                antiCheat.violations > 0 ? 'border-destructive text-destructive' : 'border-muted text-muted-foreground'
              }`}>
                <Shield className="h-3 w-3" />
                {antiCheat.violations > 0 ? `${antiCheat.violations}/3 warnings` : 'Monitored'}
              </div>
              {/* Answered count */}
              <div className="px-3 py-1.5 rounded-lg border bg-muted text-sm font-medium">
                {answeredCount}/{totalQuestions} answered
              </div>
              {/* Timer */}
              {timeLeft !== null && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-mono text-base sm:text-lg font-bold transition-colors ${
                  isUrgent ? 'border-destructive bg-destructive/10 text-destructive animate-pulse' :
                  isWarning ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                  'border-primary bg-primary/5 text-primary'
                }`}>
                  {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>
          {timeLeft !== null && (
            <Progress value={progressPercent} className={`h-2 mt-3 ${isUrgent ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''}`} />
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {randomizedQuestions.map((q, idx) => (
            <div key={q.id} className="space-y-3 p-3 sm:p-4 border rounded-lg">
              <p className="font-medium text-sm sm:text-base" style={{ userSelect: 'none' }}>
                {idx + 1}. {q.question_text}
                <span className="text-xs sm:text-sm text-muted-foreground ml-2">({q.points} pt{q.points > 1 ? 's' : ''})</span>
              </p>
              <div className="space-y-2">
                {(q.options as string[]).map((opt: string, oIdx: number) => (
                  <label key={oIdx} className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors text-sm sm:text-base ${answers[q.id] === oIdx ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} style={{ userSelect: 'none' }}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === oIdx}
                      onChange={() => setAnswers(prev => ({ ...prev, [q.id]: oIdx }))}
                      className="accent-primary shrink-0"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <Button onClick={() => setConfirmOpen(true)} disabled={submitting} className="w-full">
            <CheckCircle className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {unansweredCount > 0
              ? `Are you sure? You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}.`
              : `You have answered all ${totalQuestions} questions. Ready to submit?`
            }
          </p>
          {antiCheat.violations > 0 && (
            <p className="text-xs text-destructive">Note: {antiCheat.violations} violation(s) were recorded during this attempt.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Go Back</Button>
            <Button onClick={doSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

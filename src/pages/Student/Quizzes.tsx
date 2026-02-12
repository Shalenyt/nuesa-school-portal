import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookOpen, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { QuizAttempt } from '@/components/Student/QuizAttempt';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StudentQuizzes() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'attempt'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsChecking, setGpsChecking] = useState(false);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
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

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const startQuiz = async (quiz: any) => {
    const existing = mySubmissions.find(s => s.quiz_id === quiz.id);
    if (existing) {
      toast({ title: 'Already submitted', description: 'You have already taken this quiz.', variant: 'destructive' });
      return;
    }

    // GPS validation if enabled
    if (quiz.gps_enabled && quiz.latitude && quiz.longitude) {
      setGpsChecking(true);
      try {
        const position = await getCurrentPosition();
        const distance = haversineDistance(
          quiz.latitude, quiz.longitude,
          position.coords.latitude, position.coords.longitude
        );
        const allowedRadius = quiz.allowed_radius_meters || 100;

        if (distance > allowedRadius) {
          toast({
            title: 'Too far from exam location',
            description: `You are ${Math.round(distance)}m away. You must be within ${allowedRadius}m to start this quiz.`,
            variant: 'destructive'
          });
          setGpsChecking(false);
          return;
        }
      } catch (err: any) {
        toast({
          title: 'GPS Required',
          description: 'This quiz requires location access. Please enable GPS and try again.',
          variant: 'destructive'
        });
        setGpsChecking(false);
        return;
      }
      setGpsChecking(false);
    }

    const { data } = await (supabase as any)
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('sort_order', { ascending: true });

    setSelectedQuiz(quiz);
    setQuestions(data || []);
    setView('attempt');
  };

  const submitQuiz = async (submittedAnswers: Record<string, number>, deviceInfo?: any) => {
    if (!selectedQuiz || !profile) return;

    // Get student location for logging
    let lat: number | undefined, lng: number | undefined;
    try {
      const position = await getCurrentPosition();
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch {}

    const { error } = await (supabase as any)
      .from('quiz_submissions')
      .insert({
        quiz_id: selectedQuiz.id,
        student_id: profile.id,
        answers: submittedAnswers,
        device_info: deviceInfo || {},
        latitude: lat,
        longitude: lng,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quiz submitted successfully!' });
      setView('list');
      fetchData();
    }
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
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{q.max_points} pts</Badge>
                        {q.duration_minutes && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{q.duration_minutes} min</Badge>}
                        {q.gps_enabled && <Badge variant="outline" className="text-orange-600"><MapPin className="h-3 w-3 mr-1" />GPS Required</Badge>}
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
                {mySubmissions.map((s) => {
                  const released = s.quizzes?.results_released !== false;
                  return (
                    <Card key={s.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{s.quizzes?.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{s.quizzes?.courses?.name}</p>
                      </CardHeader>
                      <CardContent>
                        {!released ? (
                          <Badge variant="secondary">Results Pending</Badge>
                        ) : s.score !== null ? (
                          <Badge variant="default">{s.score}/{s.quizzes?.max_points || 100}</Badge>
                        ) : (
                          <Badge variant="secondary">Awaiting grading</Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {mySubmissions.length === 0 && (
                  <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No quiz submissions yet.</p></CardContent></Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {view === 'attempt' && selectedQuiz && profile && (
          <QuizAttempt
            quiz={selectedQuiz}
            questions={questions}
            onSubmit={submitQuiz}
            studentId={profile.id}
          />
        )}

        {/* GPS checking overlay */}
        {gpsChecking && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <Card className="max-w-sm w-full">
              <CardContent className="pt-6 text-center space-y-3">
                <MapPin className="h-8 w-8 text-primary mx-auto animate-pulse" />
                <p className="font-medium">Verifying your location...</p>
                <p className="text-sm text-muted-foreground">Please wait while we check you're within the allowed area.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

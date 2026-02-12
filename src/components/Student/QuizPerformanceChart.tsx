import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export function QuizPerformanceChart() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const { data: subs } = await (supabase as any)
        .from('quiz_submissions')
        .select('score, submitted_at, quizzes(title, max_points)')
        .eq('student_id', profile!.id)
        .not('score', 'is', null)
        .order('submitted_at', { ascending: true });

      if (!subs?.length) { setLoading(false); return; }

      const chartData = subs.map((s: any) => ({
        name: s.quizzes?.title?.substring(0, 15) || 'Quiz',
        score: Math.round((s.score / (s.quizzes?.max_points || 100)) * 100),
        date: new Date(s.submitted_at).toLocaleDateString(),
      }));

      setData(chartData);
    } catch (err) {
      console.error('Error fetching quiz performance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) return null;

  const avg = Math.round(data.reduce((a, d) => a + d.score, 0) / data.length);
  const trend = data.length >= 2 ? data[data.length - 1].score - data[0].score : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Quiz Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm">
          <div><span className="text-muted-foreground">Average:</span> <span className="font-semibold">{avg}%</span></div>
          <div><span className="text-muted-foreground">Trend:</span> <span className={`font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>{trend >= 0 ? '+' : ''}{trend}%</span></div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

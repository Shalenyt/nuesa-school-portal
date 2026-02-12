import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';

export function ClassAverageCard() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const { data: quizzes } = await (supabase as any)
        .from('quizzes')
        .select('id, title, max_points')
        .eq('created_by', profile!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!quizzes?.length) { setLoading(false); return; }

      const chartData = [];
      for (const q of quizzes) {
        const { data: subs } = await (supabase as any)
          .from('quiz_submissions')
          .select('score')
          .eq('quiz_id', q.id)
          .not('score', 'is', null);

        if (!subs?.length) continue;

        const scores = subs.map((s: any) => s.score);
        const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
        const highest = Math.max(...scores);
        const lowest = Math.min(...scores);

        chartData.push({
          name: q.title?.substring(0, 12) || 'Quiz',
          average: Math.round((avg / (q.max_points || 100)) * 100),
          highest: Math.round((highest / (q.max_points || 100)) * 100),
          lowest: Math.round((lowest / (q.max_points || 100)) * 100),
        });
      }

      setData(chartData);
    } catch (err) {
      console.error('Error fetching class averages:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Class Average Per Quiz
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <Bar dataKey="average" fill="hsl(var(--primary))" name="Average %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

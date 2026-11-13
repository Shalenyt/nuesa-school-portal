import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/Shared/UserAvatar';

const SEEN_KEY = 'nuesa_winner_seen';
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };
const markSeen = (id: string) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), id].slice(-50))); } catch { /* ignore */ } };

interface Result {
  positionId: string;
  positionName: string;
  winners: { name: string; photo: string | null; votes: number }[];
  total: number;
}

const COLORS = ['#16a34a', '#facc15', '#2563eb', '#ef4444', '#f97316', '#a855f7', '#14b8a6'];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.4 + Math.random() * 1.8,
    size: 6 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 160,
    round: Math.random() > 0.6,
  })), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[101] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece absolute top-[-20px]"
          style={{
            left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color,
            borderRadius: p.round ? '50%' : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
            ['--drift' as any]: `${p.drift}px`,
          }} />
      ))}
    </div>
  );
}

/**
 * When an election closes, everyone who could vote in it sees a winner card
 * with confetti once (the result notification tells us which election).
 */
export function WinnerCelebration() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);

  const check = useCallback(async () => {
    if (!user || profile?.status !== 'approved') return;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: notes } = await (supabase as any).from('notifications')
      .select('related_id, created_at').eq('user_id', user.id).eq('type', 'election_result')
      .not('related_id', 'is', null).gte('created_at', since).order('created_at', { ascending: false }).limit(5);
    const seen = readSeen();
    const next = (notes || []).find((n: any) => !seen.includes(n.related_id));
    if (!next) return;

    const posId = next.related_id as string;
    const [{ data: pos }, { data: rows }] = await Promise.all([
      (supabase as any).from('electoral_positions').select('name').eq('id', posId).maybeSingle(),
      (supabase as any).from('election_results')
        .select('vote_count, is_winner, candidates:candidate_id(profile_pic, profiles:student_id(full_name, profile_photo_url))')
        .eq('position_id', posId),
    ]);
    if (!pos || !rows?.length) return;
    const total = rows.reduce((s: number, r: any) => s + (r.vote_count || 0), 0);
    const winners = rows.filter((r: any) => r.is_winner).map((r: any) => ({
      name: r.candidates?.profiles?.full_name || 'Candidate',
      photo: r.candidates?.profile_pic || r.candidates?.profiles?.profile_photo_url || null,
      votes: r.vote_count || 0,
    }));
    setResult({ positionId: posId, positionName: pos.name, winners, total });
  }, [user, profile?.status]);

  useEffect(() => {
    if (!user) return;
    check();
    const channel = supabase
      .channel(`winner-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => { if (payload.new?.type === 'election_result') setTimeout(check, 1500); })
      // Elections are broadcast live, so the card shows within seconds of closing
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'electoral_positions' },
        (payload: any) => { if (payload.new?.election_status === 'closed') { setTimeout(check, 2000); setTimeout(check, 6000); } })
      .subscribe();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, [user, check]);

  if (!result) return null;
  const close = () => { markSeen(result.positionId); setResult(null); };
  const tie = result.winners.length > 1;
  const w = result.winners[0];

  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={close}>
        <div className="winner-pop relative w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={close} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/20 text-yellow-500"><Trophy className="h-6 w-6" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">{result.positionName}</p>
          {!w ? (
            <p className="mt-3 text-lg font-bold">The election ended with no votes cast.</p>
          ) : (
            <>
              <div className="mt-4 flex justify-center gap-3">
                {result.winners.map((x) => (
                  <Avatar key={x.name} className="h-24 w-24 border-4 border-yellow-400">
                    <SignedAvatarImage src={x.photo} className="object-cover" />
                    <AvatarFallback className="text-2xl">{x.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <h2 className="mt-4 text-2xl font-extrabold leading-tight">
                {tie ? 'It is a tie' : `${w.name} won`}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {tie
                  ? `${result.winners.map((x) => x.name).join(' and ')} tied with ${w.votes} votes each.`
                  : `${w.name} is the new ${result.positionName}, with ${w.votes} of ${result.total} votes.`}
              </p>
            </>
          )}
          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={close}>Close</Button>
            <Button className="flex-1 rounded-full" onClick={() => { close(); navigate(profile?.role === 'admin' ? '/admin/voting' : '/student/voting'); }}>See results</Button>
          </div>
        </div>
      </div>
    </>
  );
}

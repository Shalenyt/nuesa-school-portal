import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/Shared/UserAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Vote, User, Send, BarChart3, Trophy, Clock, StopCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

function CountdownTimer({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) setRemaining(`${Math.floor(h / 24)}d ${h % 24}h ${m}m`);
      else setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <Badge variant="outline" className="flex items-center gap-1 text-xs">
      <Clock className="h-3 w-3" /> {remaining}
    </Badge>
  );
}

export default function StudentVoting() {
  const { profile } = useAuth();
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [myVotes, setMyVotes] = useState<any[]>([]);
  const [myCandidacies, setMyCandidacies] = useState<any[]>([]);
  const [electionResults, setElectionResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyPosition, setApplyPosition] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [applying, setApplying] = useState(false);
  const [confirmVote, setConfirmVote] = useState<{ candidate: any; position: any } | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (profile) fetchAll();
    const channel = supabase
      .channel('student-voting')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => { if (profile) fetchAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electoral_positions' }, () => { if (profile) fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchAll = async () => {
    const [posRes, candRes, myVotesRes, myCandRes, resultsRes] = await Promise.all([
      (supabase as any).from('electoral_positions').select('*').eq('published', true).order('created_at'),
      (supabase as any).from('candidates').select('*, profiles:student_id(full_name, student_id, profile_photo_url, subjects:department_id(name), classes:level_id(name))').eq('approved', true),
      (supabase as any).from('votes').select('*').eq('voter_id', profile?.id),
      (supabase as any).from('candidates').select('*, electoral_positions:position_id(name)').eq('student_id', profile?.id),
      (supabase as any).from('election_results').select('*').order('vote_count', { ascending: false }),
    ]);
    setPositions(posRes.data || []);
    setCandidates(candRes.data || []);
    setMyVotes(myVotesRes.data || []);
    setMyCandidacies(myCandRes.data || []);
    setElectionResults(resultsRes.data || []);

    // Fetch vote counts
    const counts: Record<string, Record<string, number>> = {};
    if (posRes.data) {
      for (const pos of posRes.data) {
        counts[pos.id] = {};
        const posCands = (candRes.data || []).filter((c: any) => c.position_id === pos.id);
        for (const cand of posCands) {
          const { count } = await (supabase as any).from('votes').select('*', { count: 'exact', head: true }).eq('position_id', pos.id).eq('candidate_id', cand.id);
          counts[pos.id][cand.id] = count || 0;
        }
      }
    }
    setVoteCounts(counts);
    setLoading(false);
  };

  const hasVoted = (posId: string) => myVotes.some(v => v.position_id === posId);

  const handleApply = async () => {
    if (!applyPosition || !profile) return;
    setApplying(true);
    const { error } = await (supabase as any).from('candidates').insert({
      student_id: profile.id, position_id: applyPosition,
      manifesto: manifesto.trim() || null, profile_pic: profile.profile_photo_url,
    });
    if (error) {
      toast({ title: "Error", description: error.message.includes('duplicate') ? 'You already applied for this position' : error.message, variant: "destructive" });
    } else {
      toast({ title: "Application submitted!", description: "Awaiting admin approval." });
      setManifesto(''); setApplyPosition(''); fetchAll();
    }
    setApplying(false);
  };

  const handleVote = async () => {
    if (!confirmVote || !profile) return;
    setVoting(true);
    const { error } = await (supabase as any).from('votes').insert({
      voter_id: profile.id, candidate_id: confirmVote.candidate.id, position_id: confirmVote.position.id,
    });
    if (error) {
      toast({ title: "Vote failed", description: error.message.includes('duplicate') ? 'You have already voted for this position' : error.message, variant: "destructive" });
    } else {
      toast({ title: "Vote registered!", description: `You voted for ${confirmVote.candidate.profiles?.full_name}` });
      fetchAll();
    }
    setConfirmVote(null); setVoting(false);
  };

  const getTotalVotes = (posId: string) => {
    const posCounts = voteCounts[posId] || {};
    return Object.values(posCounts).reduce((a, b) => a + b, 0);
  };

  const getWinner = (posId: string) => {
    const result = electionResults.find(r => r.position_id === posId && r.is_winner);
    if (!result) return null;
    const cand = candidates.find(c => c.id === result.candidate_id);
    return { ...result, name: cand?.profiles?.full_name };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voting</h1>
          <p className="text-muted-foreground">Apply for positions, cast your votes, and view results</p>
        </div>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <Tabs defaultValue="vote" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="apply">Apply</TabsTrigger>
              <TabsTrigger value="vote">Vote</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            {/* Apply Tab */}
            <TabsContent value="apply">
              <Card>
                <CardHeader><CardTitle>Apply for a Position</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Select value={applyPosition} onValueChange={setApplyPosition}>
                    <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      {positions.filter(p => !myCandidacies.some(c => c.position_id === p.id) && p.election_status !== 'closed').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Write your manifesto..." value={manifesto} onChange={e => setManifesto(e.target.value)} rows={4} />
                  <Button onClick={handleApply} disabled={!applyPosition || applying}>
                    <Send className="h-4 w-4 mr-2" /> {applying ? 'Submitting...' : 'Submit Application'}
                  </Button>

                  {myCandidacies.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-2">Your Applications</h3>
                      <div className="space-y-2">
                        {myCandidacies.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{(c.electoral_positions as any)?.name}</p>
                              {c.manifesto && <p className="text-xs text-muted-foreground line-clamp-1">{c.manifesto}</p>}
                            </div>
                            <Badge variant={c.approved ? 'default' : 'secondary'}>{c.approved ? 'Approved' : 'Pending'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vote Tab */}
            <TabsContent value="vote">
              <div className="space-y-6">
                {positions.filter(p => p.voting_open).length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground">No active elections at the moment.</CardContent></Card>
                ) : positions.filter(p => p.voting_open).map(pos => {
                  const posCandidates = candidates.filter(c => c.position_id === pos.id);
                  const voted = hasVoted(pos.id);
                  return (
                    <Card key={pos.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Vote className="h-5 w-5" />
                            {pos.name}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {pos.voting_end_time && <CountdownTimer endTime={pos.voting_end_time} />}
                            {voted && <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Voted</Badge>}
                          </div>
                        </div>
                        {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          {posCandidates.map(cand => (
                            <Card key={cand.id} className={`overflow-hidden ${voted ? 'opacity-75' : 'hover:shadow-md transition-shadow'}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-16 w-16">
                                    <SignedAvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                                    <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold">{cand.profiles?.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{cand.profiles?.subjects?.name} • {cand.profiles?.classes?.name}</p>
                                    {cand.manifesto && <p className="text-xs mt-2 text-muted-foreground">{cand.manifesto}</p>}
                                  </div>
                                </div>
                                {!voted && (
                                  <Button className="w-full mt-3" onClick={() => setConfirmVote({ candidate: cand, position: pos })}>
                                    Vote for {cand.profiles?.full_name?.split(' ')[0]}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Show closed elections banner */}
                {positions.filter(p => p.election_status === 'closed').length > 0 && (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="pt-6 text-center">
                      <StopCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                      <p className="font-semibold">Some elections have ended</p>
                      <p className="text-sm text-muted-foreground">Check the Results tab to see winners</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results">
              <div className="space-y-6">
                {positions.map(pos => {
                  const posCandidates = candidates.filter(c => c.position_id === pos.id);
                  const totalVotes = getTotalVotes(pos.id);
                  const isClosed = pos.election_status === 'closed';
                  const winner = getWinner(pos.id);

                  return (
                    <Card key={pos.id} className={isClosed && winner ? 'border-yellow-500/30' : ''}>
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> {pos.name}
                            {isClosed && <Badge variant="destructive" className="ml-1">Closed</Badge>}
                          </CardTitle>
                          {isClosed && winner && (
                            <Badge className="bg-yellow-500 text-black flex items-center gap-1">
                              <Trophy className="h-3 w-3" /> {winner.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Total votes: {totalVotes}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {posCandidates.map(cand => {
                          const count = voteCounts[pos.id]?.[cand.id] || 0;
                          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                          const isWinner = isClosed && winner?.candidate_id === cand.id;
                          return (
                            <div key={cand.id} className={`flex items-center gap-3 p-2 rounded-lg ${isWinner ? 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-500/30' : ''}`}>
                              <Avatar className="h-8 w-8">
                                <SignedAvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                                <AvatarFallback>{cand.profiles?.full_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium flex items-center gap-1">
                                    {cand.profiles?.full_name}
                                    {isWinner && <Trophy className="h-3 w-3 text-yellow-500" />}
                                  </span>
                                  <span className="text-muted-foreground">{count} ({pct}%)</span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            </div>
                          );
                        })}
                        {posCandidates.length === 0 && <p className="text-muted-foreground text-sm">No candidates</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Vote Confirmation Dialog */}
        <Dialog open={!!confirmVote} onOpenChange={() => setConfirmVote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Your Vote</DialogTitle>
            </DialogHeader>
            {confirmVote && (
              <div className="space-y-4">
                <p className="text-sm">
                  Are you sure you want to vote for <span className="font-bold">{confirmVote.candidate.profiles?.full_name}</span> for the position of <span className="font-bold">{confirmVote.position.name}</span>?
                </p>
                <p className="text-xs text-destructive">This action cannot be undone. You can only vote once per position.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmVote(null)}>No, Go Back</Button>
              <Button onClick={handleVote} disabled={voting}>{voting ? 'Voting...' : 'Yes, Cast My Vote'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

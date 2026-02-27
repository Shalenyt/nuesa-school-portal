import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, CheckCircle, XCircle, Users, BarChart3, Download, Vote, Eye, Trash2, Clock, Trophy, StopCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function AdminVoting() {
  const { profile } = useAuth();
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [electionResults, setElectionResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPosition, setNewPosition] = useState({ name: '', description: '', closingMode: 'manual' as 'manual' | 'scheduled', endDate: '', endTime: '' });
  const [creating, setCreating] = useState(false);
  const [voterDetails, setVoterDetails] = useState<any[]>([]);
  const [showVoters, setShowVoters] = useState(false);
  const [confirmClose, setConfirmClose] = useState<any>(null);
  const [closing, setClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'position' | 'result'; id: string; name: string } | null>(null);

  useEffect(() => { fetchAll(); setupRealtime(); }, []);

  useEffect(() => {
    const interval = setInterval(() => { checkAutoClose(); }, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  const checkAutoClose = async () => {
    const now = new Date();
    const expiredPositions = positions.filter(p => p.voting_open && p.voting_end_time && new Date(p.voting_end_time) <= now);
    if (expiredPositions.length > 0) {
      await supabase.functions.invoke('close-election', { body: {} });
      fetchAll();
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('voting-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electoral_positions' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const fetchAll = async () => {
    const [posRes, candRes, votesRes, resultsRes] = await Promise.all([
      (supabase as any).from('electoral_positions').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('candidates').select('*, profiles:student_id(full_name, student_id, department_id, level_id, profile_photo_url, subjects:department_id(name), classes:level_id(name))').order('created_at'),
      (supabase as any).from('votes').select('*, profiles:voter_id(full_name, student_id, subjects:department_id(name), classes:level_id(name))').order('created_at', { ascending: false }),
      (supabase as any).from('election_results').select('*').order('vote_count', { ascending: false }),
    ]);
    setPositions(posRes.data || []);
    setCandidates(candRes.data || []);
    setVotes(votesRes.data || []);
    setElectionResults(resultsRes.data || []);
    setLoading(false);
  };

  const createPosition = async () => {
    if (!newPosition.name.trim()) return;
    let votingEndTime: string | null = null;
    if (newPosition.closingMode === 'scheduled' && newPosition.endDate && newPosition.endTime) {
      votingEndTime = new Date(`${newPosition.endDate}T${newPosition.endTime}`).toISOString();
    }
    const { error } = await (supabase as any).from('electoral_positions').insert({
      name: newPosition.name.trim(),
      description: newPosition.description.trim() || null,
      voting_end_time: votingEndTime,
      election_status: 'draft',
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Position created" });
    setNewPosition({ name: '', description: '', closingMode: 'manual', endDate: '', endTime: '' });
    setCreating(false);
    fetchAll();
  };

  const togglePublish = async (pos: any) => {
    await (supabase as any).from('electoral_positions').update({ published: !pos.published, election_status: !pos.published ? 'published' : 'draft' }).eq('id', pos.id);
    fetchAll();
  };

  const toggleVoting = async (pos: any) => {
    if (pos.election_status === 'closed') {
      toast({ title: "Election Closed", description: "This election has been permanently closed.", variant: "destructive" });
      return;
    }
    await (supabase as any).from('electoral_positions').update({ voting_open: !pos.voting_open, election_status: !pos.voting_open ? 'voting' : 'published' }).eq('id', pos.id);
    fetchAll();
  };

  const handleManualClose = async () => {
    if (!confirmClose) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('close-election', {
        body: { position_id: confirmClose.id, mode: 'manual' }
      });
      if (error) throw error;
      toast({ title: "Election Closed", description: `Results calculated and notifications sent for ${confirmClose.name}.` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClosing(false);
      setConfirmClose(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'position') {
        // Delete results, votes, candidates, then position
        const posCandidates = candidates.filter(c => c.position_id === deleteTarget.id);
        const candIds = posCandidates.map(c => c.id);
        if (candIds.length > 0) {
          await (supabase as any).from('election_results').delete().in('candidate_id', candIds);
          await (supabase as any).from('votes').delete().eq('position_id', deleteTarget.id);
          await (supabase as any).from('candidates').delete().eq('position_id', deleteTarget.id);
        }
        await (supabase as any).from('election_results').delete().eq('position_id', deleteTarget.id);
        await (supabase as any).from('electoral_positions').delete().eq('id', deleteTarget.id);
        toast({ title: "Position deleted", description: `"${deleteTarget.name}" and all related data removed.` });
      } else if (deleteTarget.type === 'result') {
        await (supabase as any).from('election_results').delete().eq('position_id', deleteTarget.id);
        toast({ title: "Results deleted", description: `Results for "${deleteTarget.name}" removed.` });
      }
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const [rejectTarget, setRejectTarget] = useState<any>(null);

  const approveCandidate = async (cand: any) => {
    const posName = positions.find(p => p.id === cand.position_id)?.name || 'Unknown Position';
    await (supabase as any).from('candidates').update({ approved: true }).eq('id', cand.id);

    await supabase.from('notifications').insert({
      user_id: cand.student_id,
      title: 'Application Approved',
      message: `Your application for "${posName}" has been approved. You are now an official candidate.`,
      type: 'voting',
      is_read: false,
    });

    toast({ title: "Candidate approved" });
    fetchAll();
  };

  const rejectCandidate = async () => {
    if (!rejectTarget) return;
    const posName = positions.find(p => p.id === rejectTarget.position_id)?.name || 'Unknown Position';
    
    // Delete the candidate application completely
    await (supabase as any).from('candidates').delete().eq('id', rejectTarget.id);

    await supabase.from('notifications').insert({
      user_id: rejectTarget.student_id,
      title: 'Application Rejected',
      message: `Your application for "${posName}" has been rejected.`,
      type: 'voting',
      is_read: false,
    });

    toast({ title: "Candidate rejected and removed" });
    setRejectTarget(null);
    fetchAll();
  };

  const viewVoters = (posId: string, candId: string) => {
    const posVotes = votes.filter(v => v.position_id === posId && v.candidate_id === candId);
    setVoterDetails(posVotes);
    setShowVoters(true);
  };

  const exportVotes = (posId: string) => {
    const posVotes = votes.filter(v => v.position_id === posId);
    const pos = positions.find(p => p.id === posId);
    const headers = ['Voter Name', 'Matric No', 'Department', 'Level', 'Candidate', 'Timestamp'];
    const rows = posVotes.map(v => {
      const cand = candidates.find(c => c.id === v.candidate_id);
      return [v.profiles?.full_name || '', v.profiles?.student_id || '', v.profiles?.subjects?.name || '', v.profiles?.classes?.name || '', cand?.profiles?.full_name || '', new Date(v.created_at).toLocaleString()];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `votes-${pos?.name || 'export'}.csv`; a.click();
  };

  const getVoteCount = (posId: string, candId: string) => votes.filter(v => v.position_id === posId && v.candidate_id === candId).length;
  const getTotalVotes = (posId: string) => votes.filter(v => v.position_id === posId).length;

  const getStatusBadge = (pos: any) => {
    if (pos.election_status === 'closed') return <Badge variant="destructive">Closed</Badge>;
    if (pos.voting_open) return <Badge className="bg-green-600">Voting Open</Badge>;
    if (pos.published) return <Badge>Published</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  const getTimeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Voting Management</h1>
            <p className="text-muted-foreground">Manage electoral positions, candidates, and results</p>
          </div>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" /> New Position</Button>
        </div>

        {creating && (
          <Card>
            <CardHeader><CardTitle>Create Electoral Position</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Position name (e.g. President)" value={newPosition.name} onChange={e => setNewPosition(p => ({ ...p, name: e.target.value }))} />
              <Textarea placeholder="Description (optional)" value={newPosition.description} onChange={e => setNewPosition(p => ({ ...p, description: e.target.value }))} />
              <div className="space-y-3">
                <Label className="font-semibold">Election Closing Method</Label>
                <RadioGroup value={newPosition.closingMode} onValueChange={(v: 'manual' | 'scheduled') => setNewPosition(p => ({ ...p, closingMode: v }))}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual">Manual Close — Admin closes election manually</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="scheduled" id="scheduled" />
                    <Label htmlFor="scheduled">Scheduled End Time — Auto-closes at set time</Label>
                  </div>
                </RadioGroup>
                {newPosition.closingMode === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div>
                      <Label className="text-xs">End Date</Label>
                      <Input type="date" value={newPosition.endDate} onChange={e => setNewPosition(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input type="time" value={newPosition.endTime} onChange={e => setNewPosition(p => ({ ...p, endTime: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={createPosition}>Create</Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="positions">Manage Positions</TabsTrigger>
            <TabsTrigger value="candidates">Approve Candidates</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {loading ? <div className="text-center py-8">Loading...</div> : (
              <div className="space-y-4">
                {positions.length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground">No positions created yet.</CardContent></Card>
                ) : positions.map(pos => (
                  <Card key={pos.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="text-base">{pos.name}</CardTitle>
                          {pos.description && <p className="text-sm text-muted-foreground mt-1">{pos.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pos)}
                          {pos.voting_open && pos.voting_end_time && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {getTimeRemaining(pos.voting_end_time)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {pos.election_status === 'closed' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-destructive">
                            <StopCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Election Permanently Closed</span>
                          </div>
                          {(() => {
                            const winner = getWinner(pos.id);
                            return winner ? (
                              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                <Trophy className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm font-medium">Winner: {winner.name} ({winner.vote_count} votes)</span>
                              </div>
                            ) : null;
                          })()}
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: 'position', id: pos.id, name: pos.name })}>
                            <Trash2 className="h-3 w-3 mr-1" /> Delete Position
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Switch checked={pos.published} onCheckedChange={() => togglePublish(pos)} disabled={pos.election_status === 'closed'} />
                            <Label>Published</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={pos.voting_open} onCheckedChange={() => toggleVoting(pos)} disabled={!pos.published || pos.election_status === 'closed'} />
                            <Label>Voting Open</Label>
                          </div>
                          {pos.voting_open && (
                            <Button size="sm" variant="destructive" onClick={() => setConfirmClose(pos)}>
                              <StopCircle className="h-3 w-3 mr-1" /> Close Election
                            </Button>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {candidates.filter(c => c.position_id === pos.id).length} applicants • {candidates.filter(c => c.position_id === pos.id && c.approved).length} approved • {getTotalVotes(pos.id)} votes
                          </p>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: 'position', id: pos.id, name: pos.name })} className="ml-auto">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="candidates">
            <div className="space-y-4">
              {positions.map(pos => {
                const posCandidates = candidates.filter(c => c.position_id === pos.id);
                if (posCandidates.length === 0) return null;
                return (
                  <Card key={pos.id}>
                    <CardHeader><CardTitle className="text-base">{pos.name} - Applicants ({posCandidates.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {posCandidates.map(cand => (
                        <div key={cand.id} className="flex items-center gap-4 p-3 border rounded-lg">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                            <AvatarFallback>{cand.profiles?.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{cand.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{cand.profiles?.student_id} • {cand.profiles?.subjects?.name} • {cand.profiles?.classes?.name}</p>
                            {cand.manifesto && <p className="text-xs mt-1 text-muted-foreground line-clamp-2">{cand.manifesto}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={cand.approved ? 'default' : 'secondary'}>{cand.approved ? 'Approved' : 'Pending'}</Badge>
                            {!cand.approved && (
                              <>
                                <Button size="sm" onClick={() => approveCandidate(cand)}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setRejectTarget(cand)}>
                                  <XCircle className="h-3 w-3 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {cand.approved && (
                              <Button size="sm" variant="destructive" onClick={() => setRejectTarget(cand)}>
                                <XCircle className="h-3 w-3 mr-1" /> Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              {candidates.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">No applications yet.</CardContent></Card>}
            </div>
          </TabsContent>

          <TabsContent value="results">
            <div className="space-y-6">
              {positions.filter(p => p.published).map(pos => {
                const posCandidates = candidates.filter(c => c.position_id === pos.id && c.approved);
                const totalVotes = getTotalVotes(pos.id);
                const isClosed = pos.election_status === 'closed';
                const winner = getWinner(pos.id);

                return (
                  <Card key={pos.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Vote className="h-4 w-4" /> {pos.name}
                            {isClosed && <Badge variant="destructive" className="ml-2">Closed</Badge>}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Total votes: {totalVotes}</p>
                        </div>
                        <div className="flex gap-2">
                          {isClosed && winner && (
                            <Badge className="bg-yellow-500 text-black flex items-center gap-1">
                              <Trophy className="h-3 w-3" /> Winner: {winner.name}
                            </Badge>
                          )}
                          <Button size="sm" variant="outline" onClick={() => exportVotes(pos.id)}>
                            <Download className="h-3 w-3 mr-1" /> Export
                          </Button>
                          {isClosed && (
                            <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: 'result', id: pos.id, name: pos.name })}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete Results
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {posCandidates.map(cand => {
                        const voteCount = getVoteCount(pos.id, cand.id);
                        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                        const isWinner = isClosed && winner?.candidate_id === cand.id;
                        return (
                          <div key={cand.id} className={`flex items-center gap-4 p-3 border rounded-lg ${isWinner ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                              <AvatarFallback>{cand.profiles?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm flex items-center gap-1">
                                {cand.profiles?.full_name}
                                {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                              </p>
                              <div className="w-full bg-muted rounded-full h-2 mt-1">
                                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{voteCount}</p>
                              <p className="text-xs text-muted-foreground">{percentage}%</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => viewVoters(pos.id, cand.id)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {posCandidates.length === 0 && <p className="text-muted-foreground text-sm">No approved candidates</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this {deleteTarget?.type === 'position' ? 'position' : 'result'} permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.type === 'position'
                  ? `This will permanently delete "${deleteTarget?.name}" along with all related candidates, votes, and results. This action cannot be undone.`
                  : `This will permanently delete the results for "${deleteTarget?.name}". This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Close Election Confirmation */}
        <Dialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <StopCircle className="h-5 w-5" /> Close Election
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">Are you sure you want to close the election for <strong>{confirmClose?.name}</strong>?</p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm space-y-1">
                <p>• Voting will be <strong>permanently disabled</strong></p>
                <p>• Results will be <strong>calculated immediately</strong></p>
                <p>• <strong>Urgent notifications</strong> will be sent to all users</p>
                <p>• This action <strong>cannot be undone</strong></p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmClose(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleManualClose} disabled={closing}>
                {closing ? 'Closing...' : 'Close Election & Announce Results'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Voter Details Dialog */}
        <Dialog open={showVoters} onOpenChange={setShowVoters}>
          <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Voter Details ({voterDetails.length})</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {voterDetails.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{v.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{v.profiles?.student_id} • {v.profiles?.subjects?.name} • {v.profiles?.classes?.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Candidate Confirmation */}
        <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to reject and delete this application?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove {rejectTarget?.profiles?.full_name}'s application. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={rejectCandidate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject & Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

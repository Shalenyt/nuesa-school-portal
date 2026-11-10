import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/Shared/UserAvatar';
import { CandidatePreview } from '@/components/Shared/CandidatePreview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckCircle, XCircle, Users, BarChart3, Download, Vote, Eye, Trash2, Clock, Trophy, StopCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { DateInput } from '@/components/ui/date-input';

export default function AdminVoting() {
  const { profile } = useAuth();
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  // Live counts per position and candidate, from the database (election_tallies)
  const [tallies, setTallies] = useState<Record<string, Record<string, number>>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [electionResults, setElectionResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPosition, setNewPosition] = useState({ name: '', description: '', departmentId: 'all', closingMode: 'manual' as 'manual' | 'scheduled', endDate: '', endTime: '' });
  const [creating, setCreating] = useState(false);
  const [voterDetails, setVoterDetails] = useState<any[]>([]);
  const [showVoters, setShowVoters] = useState(false);
  const [confirmClose, setConfirmClose] = useState<any>(null);
  const [closing, setClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'position' | 'result'; id: string; name: string } | null>(null);

  const closeRequested = useRef<Set<string>>(new Set());

  const fetchTallies = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('election_tallies');
    if (error) { console.error('Tallies failed:', error); return; }
    const t: Record<string, Record<string, number>> = {};
    for (const row of data || []) {
      t[row.position_id] = t[row.position_id] || {};
      t[row.position_id][row.candidate_id] = Number(row.vote_count) || 0;
    }
    setTallies(t);
  }, []);

  const fetchAll = useCallback(async () => {
    const [posRes, candRes, resultsRes, deptRes] = await Promise.all([
      (supabase as any).from('electoral_positions').select('*, subjects:department_id(name)').order('created_at', { ascending: false }),
      (supabase as any).from('candidates').select('*, profiles:student_id(full_name, student_id, department_id, level_id, profile_photo_url, subjects:department_id(name), classes:level_id(name))').order('created_at'),
      (supabase as any).from('election_results').select('*').order('vote_count', { ascending: false }),
      supabase.from('subjects').select('id, name').order('name'),
    ]);
    setPositions(posRes.data || []);
    setCandidates(candRes.data || []);
    setElectionResults(resultsRes.data || []);
    setDepartments(deptRes.data || []);
    await fetchTallies();
    setLoading(false);
  }, [fetchTallies]);

  // Position changes arrive live; leaving the page removes the channel
  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin-voting-positions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electoral_positions' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Live counts every 5 seconds while an election is open and the tab is visible.
  // (Refetching every vote row on each new vote, as before, would not survive a busy election.)
  const anyOpen = positions.some(p => p.voting_open && p.election_status !== 'closed');
  useEffect(() => {
    if (!anyOpen) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') fetchTallies(); }, 5000);
    return () => clearInterval(timer);
  }, [anyOpen, fetchTallies]);

  // Scheduled elections close themselves when their time is up
  useEffect(() => {
    const timer = setInterval(() => {
      const expired = positions.filter(p => p.voting_open && p.election_status !== 'closed' && p.voting_end_time
        && new Date(p.voting_end_time) <= new Date() && !closeRequested.current.has(p.id));
      if (expired.length === 0) return;
      expired.forEach(p => closeRequested.current.add(p.id));
      (supabase as any).rpc('close_expired_elections').then(() => fetchAll());
    }, 5000);
    return () => clearInterval(timer);
  }, [positions, fetchAll]);

  // Every vote for a position, in pages of 1000 (the API's limit per request)
  const fetchVotes = async (posId: string, candId?: string) => {
    const all: any[] = [];
    for (let from = 0; ; from += 1000) {
      let q = (supabase as any).from('votes')
        .select('*, profiles:voter_id(full_name, student_id, subjects:department_id(name), classes:level_id(name))')
        .eq('position_id', posId).order('created_at', { ascending: true }).range(from, from + 999);
      if (candId) q = q.eq('candidate_id', candId);
      const { data, error } = await q;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
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
      department_id: newPosition.departmentId === 'all' ? null : newPosition.departmentId,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Position created" });
    setNewPosition({ name: '', description: '', departmentId: 'all', closingMode: 'manual', endDate: '', endTime: '' });
    setCreating(false);
    fetchAll();
  };

  const togglePublish = async (pos: any) => {
    const { error } = await (supabase as any).from('electoral_positions').update({ published: !pos.published, election_status: !pos.published ? 'published' : 'draft' }).eq('id', pos.id);
    if (error) toast({ title: "Couldn't change", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const toggleVoting = async (pos: any) => {
    if (pos.election_status === 'closed') {
      toast({ title: "Election Closed", description: "This election has been permanently closed.", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from('electoral_positions').update({ voting_open: !pos.voting_open, election_status: !pos.voting_open ? 'voting' : 'published' }).eq('id', pos.id);
    if (error) toast({ title: "Couldn't change", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const handleManualClose = async () => {
    if (!confirmClose) return;
    setClosing(true);
    try {
      // Locks the election, counts every vote in one go, records ties and notifies voters
      const { data, error } = await (supabase as any).rpc('close_election', { p_position_id: confirmClose.id });
      if (error) throw error;
      toast({ title: "Election Closed", description: data?.message || `Results calculated for ${confirmClose.name}.` });
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
        // Candidates, votes and results are removed with the position
        const { error } = await (supabase as any).from('electoral_positions').delete().eq('id', deleteTarget.id);
        if (error) throw error;
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
  const [preview, setPreview] = useState<{ candidate: any; position: any } | null>(null);

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

  const viewVoters = async (posId: string, candId: string) => {
    setVoterDetails([]);
    setShowVoters(true);
    setLoadingVoters(true);
    try { setVoterDetails(await fetchVotes(posId, candId)); }
    catch (e: any) { toast({ title: "Couldn't load voters", description: e.message, variant: "destructive" }); }
    finally { setLoadingVoters(false); }
  };

  const exportVotes = async (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    let posVotes: any[] = [];
    try { posVotes = await fetchVotes(posId); }
    catch (e: any) { toast({ title: "Export failed", description: e.message, variant: "destructive" }); return; }
    // Quote every cell so names with commas or quotes don't break the columns
    const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Voter Name', 'Matric No', 'Department', 'Level', 'Candidate', 'Timestamp'];
    const rows = posVotes.map(v => {
      const cand = candidates.find(c => c.id === v.candidate_id);
      return [v.profiles?.full_name, v.profiles?.student_id, v.profiles?.subjects?.name, v.profiles?.classes?.name, cand?.profiles?.full_name, new Date(v.created_at).toLocaleString()];
    });
    const csv = [headers, ...rows].map(r => r.map(cell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `votes-${pos?.name || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getVoteCount = (posId: string, candId: string) => {
    const pos = positions.find(p => p.id === posId);
    if (pos?.election_status === 'closed') {
      const r = electionResults.find(x => x.position_id === posId && x.candidate_id === candId);
      if (r) return r.vote_count;
    }
    return tallies[posId]?.[candId] || 0;
  };
  const getTotalVotes = (posId: string) =>
    candidates.filter(c => c.position_id === posId && c.approved).reduce((s, c) => s + getVoteCount(posId, c.id), 0);

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

  // Every top scorer (more than one means a tie)
  const getWinners = (posId: string) =>
    electionResults
      .filter(r => r.position_id === posId && r.is_winner)
      .map(r => ({ ...r, name: candidates.find(c => c.id === r.candidate_id)?.profiles?.full_name }));
  const winnerLabel = (posId: string) => {
    const w = getWinners(posId);
    if (w.length === 0) return null;
    return w.length > 1 ? `Tie: ${w.map(x => x.name).join(' & ')} (${w[0].vote_count} each)` : `${w[0].name} (${w[0].vote_count} votes)`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
              <div className="space-y-1">
                <Label className="font-semibold">Who can vote and apply</Label>
                <Select value={newPosition.departmentId} onValueChange={(v) => setNewPosition(p => ({ ...p, departmentId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} only</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                      <DateInput value={newPosition.endDate} onChange={(v) => setNewPosition(p => ({ ...p, endDate: v }))} />
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
            {/* Short labels on phones so the three tabs don't run into each other */}
            <TabsTrigger value="positions" className="px-1 text-xs sm:text-sm"><span className="sm:hidden">Positions</span><span className="hidden sm:inline">Manage Positions</span></TabsTrigger>
            <TabsTrigger value="candidates" className="px-1 text-xs sm:text-sm"><span className="sm:hidden">Candidates</span><span className="hidden sm:inline">Approve Candidates</span></TabsTrigger>
            <TabsTrigger value="results" className="px-1 text-xs sm:text-sm">Results</TabsTrigger>
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
                          <p className="text-xs text-muted-foreground mt-1">{pos.subjects?.name ? `${pos.subjects.name} students only` : 'All departments'}</p>
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
                          {winnerLabel(pos.id) ? (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                              <Trophy className="h-4 w-4 text-yellow-500" />
                              <span className="text-sm font-medium">Winner: {winnerLabel(pos.id)}</span>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No votes were cast.</p>
                          )}
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
                        <div
                          key={cand.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setPreview({ candidate: cand, position: pos })}
                          onKeyDown={(e) => { if (e.key === 'Enter') setPreview({ candidate: cand, position: pos }); }}
                          className="flex cursor-pointer flex-col gap-3 rounded-2xl border p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
                        >
                          <Avatar className="h-12 w-12">
                            <SignedAvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                            <AvatarFallback>{cand.profiles?.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{cand.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{cand.profiles?.student_id} • {cand.profiles?.subjects?.name} • {cand.profiles?.classes?.name}</p>
                            {cand.manifesto && <p className="text-xs mt-1 text-muted-foreground line-clamp-2">{cand.manifesto}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                            {cand.approved && pos.election_status !== 'closed' && (
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
                const winners = isClosed ? getWinners(pos.id) : [];
                const live = pos.voting_open && !isClosed;

                return (
                  <Card key={pos.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Vote className="h-4 w-4" /> {pos.name}
                            {isClosed && <Badge variant="destructive" className="ml-2">Closed</Badge>}
                            {live && <Badge className="ml-2 bg-green-600">Live</Badge>}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Total votes: {totalVotes}{live ? ' · updates every 5 seconds' : ''}</p>
                        </div>
                        <div className="flex gap-2">
                          {winners.length > 0 && (
                            <Badge className="bg-yellow-500 text-black flex items-center gap-1">
                              <Trophy className="h-3 w-3" /> {winners.length > 1 ? `Tie: ${winners.map(w => w.name).join(' & ')}` : `Winner: ${winners[0].name}`}
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
                        const isWinner = winners.some(w => w.candidate_id === cand.id);
                        return (
                          <div key={cand.id} className={`flex items-center gap-4 p-3 border rounded-lg ${isWinner ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
                            <Avatar className="h-10 w-10">
                              <SignedAvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
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
                <p>• The result is sent to <strong>{confirmClose?.subjects?.name ? `all ${confirmClose.subjects.name} students` : 'all students'}</strong> and admins</p>
                <p>• Votes arriving while it closes are counted or refused, never lost</p>
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
            <DialogHeader><DialogTitle>Voter Details ({loadingVoters ? '…' : voterDetails.length})</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {loadingVoters && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!loadingVoters && voterDetails.length === 0 && <p className="text-sm text-muted-foreground">No votes yet.</p>}
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
                This will permanently remove {rejectTarget?.profiles?.full_name}'s application.
                {rejectTarget && getVoteCount(rejectTarget.position_id, rejectTarget.id) > 0
                  ? ` Their ${getVoteCount(rejectTarget.position_id, rejectTarget.id)} vote(s) will be deleted too, and those students will be able to vote again.`
                  : ''} This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={rejectCandidate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject & Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <CandidatePreview
        candidate={preview?.candidate ?? null}
        positionName={preview?.position?.name}
        showMatric
        onClose={() => setPreview(null)}
        actions={preview && !preview.candidate.approved ? (
          <div className="grid grid-cols-2 gap-2">
            <Button className="rounded-xl" onClick={() => { const c = preview.candidate; setPreview(null); approveCandidate(c); }}>
              <CheckCircle className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={() => { const c = preview.candidate; setPreview(null); setRejectTarget(c); }}>
              <XCircle className="mr-1 h-4 w-4" /> Reject
            </Button>
          </div>
        ) : null}
      />
    </DashboardLayout>
  );
}

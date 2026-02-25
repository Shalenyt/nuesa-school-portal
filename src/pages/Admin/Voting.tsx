import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, CheckCircle, XCircle, Users, BarChart3, Download, Vote, Eye, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function AdminVoting() {
  const { profile } = useAuth();
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPosition, setNewPosition] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [voterDetails, setVoterDetails] = useState<any[]>([]);
  const [showVoters, setShowVoters] = useState(false);

  useEffect(() => { fetchAll(); setupRealtime(); }, []);

  const setupRealtime = () => {
    const channel = supabase
      .channel('voting-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const fetchAll = async () => {
    const [posRes, candRes, votesRes] = await Promise.all([
      (supabase as any).from('electoral_positions').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('candidates').select('*, profiles:student_id(full_name, student_id, department_id, level_id, profile_photo_url, subjects:department_id(name), classes:level_id(name))').order('created_at'),
      (supabase as any).from('votes').select('*, profiles:voter_id(full_name, student_id, subjects:department_id(name), classes:level_id(name))').order('created_at', { ascending: false }),
    ]);
    setPositions(posRes.data || []);
    setCandidates(candRes.data || []);
    setVotes(votesRes.data || []);
    setLoading(false);
  };

  const createPosition = async () => {
    if (!newPosition.name.trim()) return;
    const { error } = await (supabase as any).from('electoral_positions').insert({ name: newPosition.name.trim(), description: newPosition.description.trim() || null });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Position created" });
    setNewPosition({ name: '', description: '' });
    setCreating(false);
    fetchAll();
  };

  const togglePublish = async (pos: any) => {
    await (supabase as any).from('electoral_positions').update({ published: !pos.published }).eq('id', pos.id);
    fetchAll();
  };

  const toggleVoting = async (pos: any) => {
    await (supabase as any).from('electoral_positions').update({ voting_open: !pos.voting_open }).eq('id', pos.id);
    fetchAll();
  };

  const deletePosition = async (id: string) => {
    await (supabase as any).from('electoral_positions').delete().eq('id', id);
    fetchAll();
  };

  const approveCandidate = async (id: string, approved: boolean) => {
    await (supabase as any).from('candidates').update({ approved }).eq('id', id);
    toast({ title: approved ? "Candidate approved" : "Candidate rejected" });
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
      return [
        v.profiles?.full_name || '', v.profiles?.student_id || '',
        v.profiles?.subjects?.name || '', v.profiles?.classes?.name || '',
        cand?.profiles?.full_name || '', new Date(v.created_at).toLocaleString()
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `votes-${pos?.name || 'export'}.csv`; a.click();
  };

  const getVoteCount = (posId: string, candId: string) => votes.filter(v => v.position_id === posId && v.candidate_id === candId).length;
  const getTotalVotes = (posId: string) => votes.filter(v => v.position_id === posId).length;

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
            <TabsTrigger value="results">Live Results</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {loading ? <div className="text-center py-8">Loading...</div> : (
              <div className="space-y-4">
                {positions.length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground">No positions created yet.</CardContent></Card>
                ) : positions.map(pos => (
                  <Card key={pos.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{pos.name}</CardTitle>
                          {pos.description && <p className="text-sm text-muted-foreground mt-1">{pos.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pos.published ? 'default' : 'secondary'}>{pos.published ? 'Published' : 'Draft'}</Badge>
                          {pos.voting_open && <Badge className="bg-green-600">Voting Open</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Switch checked={pos.published} onCheckedChange={() => togglePublish(pos)} />
                          <Label>Published</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={pos.voting_open} onCheckedChange={() => toggleVoting(pos)} disabled={!pos.published} />
                          <Label>Voting Open</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {candidates.filter(c => c.position_id === pos.id).length} applicants • {candidates.filter(c => c.position_id === pos.id && c.approved).length} approved • {getTotalVotes(pos.id)} votes
                        </p>
                        <Button variant="destructive" size="sm" onClick={() => deletePosition(pos.id)} className="ml-auto">
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
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
                              <Button size="sm" onClick={() => approveCandidate(cand.id, true)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Approve
                              </Button>
                            )}
                            {cand.approved && (
                              <Button size="sm" variant="destructive" onClick={() => approveCandidate(cand.id, false)}>
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
                return (
                  <Card key={pos.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Vote className="h-4 w-4" /> {pos.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Total votes: {totalVotes}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => exportVotes(pos.id)}>
                          <Download className="h-3 w-3 mr-1" /> Export
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {posCandidates.map(cand => {
                        const voteCount = getVoteCount(pos.id, cand.id);
                        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                        return (
                          <div key={cand.id} className="flex items-center gap-4 p-3 border rounded-lg">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={cand.profile_pic || cand.profiles?.profile_photo_url} />
                              <AvatarFallback>{cand.profiles?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{cand.profiles?.full_name}</p>
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
      </div>
    </DashboardLayout>
  );
}

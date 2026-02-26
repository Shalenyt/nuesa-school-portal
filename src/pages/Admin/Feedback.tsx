import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageSquare, Trash2, User, EyeOff, Circle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);

  useEffect(() => { fetchFeedback(); }, []);

  const fetchFeedback = async () => {
    const { data } = await (supabase as any).from('feedback').select('*').order('created_at', { ascending: false });
    const items = data || [];
    setFeedback(items);

    const userIds = [...new Set(items.filter((f: any) => !f.is_anonymous).map((f: any) => f.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('id, full_name, email, role').in('id', userIds as string[]);
      const map: Record<string, any> = {};
      (profileData || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  const markAsRead = async (item: any) => {
    if (!item.is_read) {
      await (supabase as any).from('feedback').update({ is_read: true }).eq('id', item.id);
      setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, is_read: true } : f));
    }
    setSelectedFeedback(item);
  };

  const deleteFeedback = async (id: string) => {
    await (supabase as any).from('feedback').delete().eq('id', id);
    toast({ title: 'Deleted' });
    setSelectedFeedback(null);
    fetchFeedback();
  };

  const renderList = (items: any[]) => {
    const filtered = typeFilter === 'all' ? items : items.filter(f => f.type === typeFilter);
    if (filtered.length === 0) return <p className="text-center text-muted-foreground py-8">No feedback found.</p>;
    return (
      <div className="space-y-3">
        {filtered.map(f => {
          const sender = f.is_anonymous ? null : profiles[f.user_id];
          return (
            <Card key={f.id} className={`cursor-pointer hover:bg-muted/50 transition-colors ${!f.is_read ? 'border-primary/50 bg-primary/5' : ''}`} onClick={() => markAsRead(f)}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!f.is_read && <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />}
                      <h3 className="font-semibold text-sm">{f.subject}</h3>
                      <Badge variant={f.type === 'complaint' ? 'destructive' : 'default'}>{f.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{f.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      {f.is_anonymous ? (
                        <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Anonymous</span>
                      ) : sender ? (
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {sender.full_name}</span>
                      ) : (
                        <span>Unknown sender</span>
                      )}
                      <span>•</span>
                      <span>{new Date(f.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFeedback(f.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const studentFeedback = feedback.filter(f => f.user_role === 'student');
  const lecturerFeedback = feedback.filter(f => f.user_role === 'teacher');

  const senderInfo = selectedFeedback && !selectedFeedback.is_anonymous ? profiles[selectedFeedback.user_id] : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feedback & Complaints</h1>
            <p className="text-muted-foreground">View feedback and complaints from students and lecturers</p>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="complaint">Complaints</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <Tabs defaultValue="students">
            <TabsList>
              <TabsTrigger value="students">
                <MessageSquare className="h-4 w-4 mr-1" /> Students ({studentFeedback.length})
              </TabsTrigger>
              <TabsTrigger value="lecturers">
                <MessageSquare className="h-4 w-4 mr-1" /> Lecturers ({lecturerFeedback.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="students">{renderList(studentFeedback)}</TabsContent>
            <TabsContent value="lecturers">{renderList(lecturerFeedback)}</TabsContent>
          </Tabs>
        )}
      </div>

      {/* Detail popup */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => { if (!open) setSelectedFeedback(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFeedback?.subject}
              <Badge variant={selectedFeedback?.type === 'complaint' ? 'destructive' : 'default'}>{selectedFeedback?.type}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{selectedFeedback?.message}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
              {selectedFeedback?.is_anonymous ? (
                <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Anonymous</span>
              ) : senderInfo ? (
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {senderInfo.full_name} ({senderInfo.email})</span>
              ) : (
                <span>Unknown sender</span>
              )}
              <span>•</span>
              <span>{selectedFeedback && new Date(selectedFeedback.created_at).toLocaleString()}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

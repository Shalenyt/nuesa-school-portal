import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Trash2 } from 'lucide-react';

export default function SemesterSettings() {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });

  useEffect(() => {
    // Auto-manage lifecycle on load
    supabase.rpc('auto_manage_semester_lifecycle').then(() => fetchSemesters()).catch(() => fetchSemesters());
  }, []);

  const fetchSemesters = async () => {
    const { data } = await (supabase as any)
      .from('semester_config')
      .select('*')
      .order('start_date', { ascending: false });
    setSemesters(data || []);
    setLoading(false);
  };

  const createSemester = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast({ title: 'Error', description: 'Fill in all fields.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('semester_config').insert(form);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Semester created.' });
      setForm({ name: '', start_date: '', end_date: '' });
      fetchSemesters();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    // Deactivate all first if activating
    if (!current) {
      await (supabase as any).from('semester_config').update({ is_active: false }).neq('id', '');
    }
    await (supabase as any).from('semester_config').update({ is_active: !current }).eq('id', id);
    fetchSemesters();
  };

  const deleteSemester = async (id: string) => {
    await (supabase as any).from('semester_config').delete().eq('id', id);
    fetchSemesters();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Semester Configuration</h1>
          <p className="text-muted-foreground">Manage academic semesters and date automation</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Add Semester</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2025/2026 First Semester" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <Button onClick={createSemester}><Plus className="h-4 w-4 mr-2" /> Create Semester</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {semesters.map(s => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {s.name}
                  </span>
                  {s.is_active && <Badge>Active</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{new Date(s.start_date).toLocaleDateString()}</span>
                  <span>→</span>
                  <span>{new Date(s.end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                    <Label className="text-sm">{s.is_active ? 'Active' : 'Inactive'}</Label>
                  </div>
                  <Button variant="destructive" size="sm" className="ml-auto" onClick={() => deleteSemester(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

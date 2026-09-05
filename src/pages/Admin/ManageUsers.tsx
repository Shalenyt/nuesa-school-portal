import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Check, X, Users, Trash2, Eye, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  student_id?: string;
  staff_id?: string;
  department_id?: string;
  level_id?: string;
  created_at: string;
}

export default function ManageUsers() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  useEffect(() => { fetchProfiles(); fetchFilters(); }, [filter]);

  const fetchFilters = async () => {
    const [{ data: depts }, { data: lvls }] = await Promise.all([
      supabase.from('subjects').select('id, name'),
      supabase.from('classes').select('id, name'),
    ]);
    setDepartments(depts || []);
    setLevels(lvls || []);
  };

  const fetchProfiles = async () => {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    setProfiles(data || []);
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, status: 'pending' | 'approved' | 'rejected') => {
    const user = profiles.find(p => p.id === userId);
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (status === 'approved' || status === 'rejected') {
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: { to: user.email, name: user.full_name, type: status, role: user.role }
        });
      } catch (e) { console.error('Email failed:', e); }
    }
    logAudit({
      action: status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'status_change',
      resourceType: 'user',
      resourceId: userId,
      resourceLabel: user.full_name,
      description: `Account ${status}`,
      oldValues: { status: user.status },
      newValues: { status },
    });
    toast({ title: 'Success', description: `User ${status} successfully` });
    fetchProfiles();
  };

  const deleteUser = async (userId: string, email: string) => {
    try {
      await supabase.functions.invoke('admin-delete-user', { body: { userId } });
      logAudit({ action: 'delete', resourceType: 'user', resourceId: userId, resourceLabel: email, description: 'Account permanently deleted' });
      toast({ title: 'Deleted', description: `${email} removed from system` });
      fetchProfiles();
    } catch (e) { toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' }); }
  };

  const filterBySearch = (list: Profile[]) => {
    let filtered = list;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.full_name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term) || p.student_id?.toLowerCase().includes(term) || p.staff_id?.toLowerCase().includes(term));
    }
    if (deptFilter !== 'all') filtered = filtered.filter(p => p.department_id === deptFilter);
    if (levelFilter !== 'all') filtered = filtered.filter(p => p.level_id === levelFilter);
    return filtered;
  };

  const admins = filterBySearch(profiles.filter(p => p.role === 'admin'));
  const lecturers = filterBySearch(profiles.filter(p => p.role === 'teacher'));
  const students = filterBySearch(profiles.filter(p => p.role === 'student'));

  const renderUserCard = (profile: Profile) => (
    <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-medium">{profile.full_name}</h3>
          <Badge variant={profile.status === 'approved' ? 'default' : profile.status === 'pending' ? 'secondary' : 'destructive'}>{profile.status}</Badge>
        </div>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p>{profile.email}</p>
          {profile.student_id && <p>Matric: {profile.student_id}</p>}
          {profile.staff_id && <p>Staff ID: {profile.staff_id}</p>}
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        {profile.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => updateUserStatus(profile.id, 'approved')}><Check className="h-4 w-4 mr-1" />Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => updateUserStatus(profile.id, 'rejected')}><X className="h-4 w-4 mr-1" />Reject</Button>
          </>
        )}
        {profile.status === 'approved' && (
          <>
            <Button size="sm" variant="outline" onClick={() => navigate(`/admin/students/${profile.id}`)}><Eye className="h-4 w-4 mr-1" />View</Button>
            <Button size="sm" variant="outline" onClick={() => updateUserStatus(profile.id, 'rejected')}><X className="h-4 w-4 mr-1" />Deactivate</Button>
          </>
        )}
        {profile.status === 'rejected' && (
          <Button size="sm" variant="outline" onClick={() => updateUserStatus(profile.id, 'approved')}><Check className="h-4 w-4 mr-1" />Reactivate</Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete <strong>{profile.full_name}</strong> ({profile.email}). This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteUser(profile.id, profile.email)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

  const renderUserList = (users: Profile[], label: string) => (
    users.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground">No {label} found</div>
    ) : (
      <div className="space-y-3">{users.map(renderUserCard)}</div>
    )
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-muted-foreground">Approve, reject, or manage user accounts</p>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name, email, ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <Tabs defaultValue="students">
            <TabsList>
              <TabsTrigger value="admins"><Users className="h-4 w-4 mr-1" /> Admins ({admins.length})</TabsTrigger>
              <TabsTrigger value="lecturers"><Users className="h-4 w-4 mr-1" /> Lecturers ({lecturers.length})</TabsTrigger>
              <TabsTrigger value="students"><Users className="h-4 w-4 mr-1" /> Students ({students.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="admins">{renderUserList(admins, 'admins')}</TabsContent>
            <TabsContent value="lecturers">{renderUserList(lecturers, 'lecturers')}</TabsContent>
            <TabsContent value="students">{renderUserList(students, 'students')}</TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

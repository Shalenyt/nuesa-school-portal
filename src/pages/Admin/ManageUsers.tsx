import { useEffect, useMemo, useState } from 'react';
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
import { Check, X, Users, Trash2, Eye, Search, Crown, ShieldOff, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
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
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [tab, setTab] = useState<'admins' | 'lecturers' | 'students'>('students');
  // Bulk actions: ids ticked in the list currently on screen
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | { label: string; done: number; total: number }>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A new tab, status, search or filter shows a different list, so start a fresh selection
  useEffect(() => { setSelected(new Set()); }, [tab, filter, searchTerm, deptFilter, levelFilter]);

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
        const { error: emailError } = await supabase.functions.invoke('send-notification-email', {
          body: { to: user.email, name: user.full_name, type: status, role: user.role }
        });
        if (emailError) throw emailError;
      } catch (e) {
        console.error('Email failed:', e);
        // The status change worked; only the email didn't go out
        toast({ title: 'Email not sent', description: `${user.full_name} was ${status}, but the email to ${user.email} could not be sent.`, variant: 'destructive' });
      }
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
      const { error } = await supabase.functions.invoke('admin-delete-user', { body: { userId } });
      if (error) throw error;
      logAudit({ action: 'delete', resourceType: 'user', resourceId: userId, resourceLabel: email, description: 'Account permanently deleted' });
      toast({ title: 'Deleted', description: `${email} removed from system` });
      fetchProfiles();
    } catch (e) { toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' }); }
  };

  // Role changes (moved here from the old User Management page)
  const changeRole = async (user: Profile, role: 'admin' | 'teacher') => {
    const { error } = await supabase.from('profiles').update({ role: role as any }).eq('id', user.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (role === 'admin') {
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: { to: user.email, name: user.full_name, type: 'promoted', role: 'admin' }
        });
      } catch (e) { console.error('Email failed:', e); }
    }
    logAudit({
      action: 'role_change',
      resourceType: 'user',
      resourceId: user.id,
      resourceLabel: user.full_name,
      description: role === 'admin' ? 'Promoted to admin' : 'Demoted to lecturer',
      oldValues: { role: user.role },
      newValues: { role },
    });
    toast({ title: 'Role updated', description: `${user.full_name} is now ${role === 'admin' ? 'an admin' : 'a lecturer'}` });
    fetchProfiles();
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

  const visible = tab === 'admins' ? admins : tab === 'lecturers' ? lecturers : students;
  // You can't bulk change or delete your own account
  const selectable = useMemo(() => visible.filter(p => p.id !== me?.id), [visible, me?.id]);
  const selectedUsers = selectable.filter(p => selected.has(p.id));
  const allSelected = selectable.length > 0 && selectedUsers.length === selectable.length;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map(p => p.id)));

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const bulkStatus = async (status: 'approved' | 'rejected') => {
    const targets = selectedUsers.filter(p => p.status !== status);
    if (targets.length === 0) {
      toast({ title: `Already ${status}`, description: `Every selected user is already ${status}.` });
      return;
    }
    const verb = status === 'approved' ? 'Approving' : 'Rejecting';
    setBulk({ label: `${verb} ${targets.length} users`, done: 0, total: targets.length });

    // One update for everyone, in chunks so very large selections stay quick
    const ids = targets.map(p => p.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('profiles').update({ status }).in('id', ids.slice(i, i + 100));
      if (error) {
        setBulk(null);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        fetchProfiles();
        return;
      }
    }

    // Emails one by one: the email service accepts about two per second
    const failed: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      setBulk({ label: `Sending emails`, done: i, total: targets.length });
      try {
        const { error } = await supabase.functions.invoke('send-notification-email', {
          body: { to: u.email, name: u.full_name, type: status, role: u.role },
        });
        if (error) throw error;
      } catch {
        failed.push(u.email);
      }
      logAudit({
        action: status === 'approved' ? 'approve' : 'reject',
        resourceType: 'user',
        resourceId: u.id,
        resourceLabel: u.full_name,
        description: `Account ${status} (bulk)`,
        oldValues: { status: u.status },
        newValues: { status },
      });
      if (i < targets.length - 1) await sleep(600);
    }
    setBulk(null);
    setSelected(new Set());
    toast({
      title: `${targets.length} users ${status}`,
      description: failed.length
        ? `${failed.length} email${failed.length === 1 ? '' : 's'} could not be sent (daily email limit or bad address). Their accounts were still ${status}.`
        : `Everyone was emailed.`,
      variant: failed.length ? 'destructive' : 'default',
    });
    fetchProfiles();
  };

  const bulkDelete = async () => {
    setConfirmDelete(false);
    const targets = selectedUsers;
    const failed: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      setBulk({ label: `Deleting ${targets.length} users`, done: i, total: targets.length });
      const { error } = await supabase.functions.invoke('admin-delete-user', { body: { userId: u.id } });
      if (error) failed.push(u.email);
      else logAudit({ action: 'delete', resourceType: 'user', resourceId: u.id, resourceLabel: u.email, description: 'Account permanently deleted (bulk)' });
    }
    setBulk(null);
    setSelected(new Set());
    toast({
      title: `${targets.length - failed.length} users deleted`,
      description: failed.length ? `${failed.length} could not be deleted. Try them again.` : undefined,
      variant: failed.length ? 'destructive' : 'default',
    });
    fetchProfiles();
  };

  const renderUserCard = (profile: Profile) => (
    // Stacks on phones so the buttons no longer sit on top of the email and matric number
    <div key={profile.id} className={`flex flex-col gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between ${selected.has(profile.id) ? 'border-primary bg-primary/5' : ''}`}>
      {profile.id !== me?.id && (
        <Checkbox
          checked={selected.has(profile.id)}
          onCheckedChange={() => toggle(profile.id)}
          disabled={!!bulk}
          aria-label={`Select ${profile.full_name}`}
          className="h-5 w-5 sm:mr-1"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
          <h3 className="font-medium break-words">{profile.full_name}</h3>
          <Badge variant={profile.status === 'approved' ? 'default' : profile.status === 'pending' ? 'secondary' : 'destructive'}>{profile.status}</Badge>
        </div>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p className="break-all">{profile.email}</p>
          {profile.student_id && <p>Matric: {profile.student_id}</p>}
          {profile.staff_id && <p>Staff ID: {profile.staff_id}</p>}
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap sm:justify-end sm:shrink-0">
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
            {profile.role === 'teacher' && (
              <Button size="sm" variant="secondary" onClick={() => changeRole(profile, 'admin')}><Crown className="h-4 w-4 mr-1" />Promote to Admin</Button>
            )}
            {profile.role === 'admin' && profile.id !== me?.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline"><ShieldOff className="h-4 w-4 mr-1" />Demote to Lecturer</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
                    <AlertDialogDescription><strong>{profile.full_name}</strong> will become a lecturer and lose access to the admin pages.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => changeRole(profile, 'teacher')}>Demote</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
      <div className="space-y-3">
        {selectable.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={!!bulk} className="h-5 w-5" />
            Select all {selectable.length} {label}
            {selectedUsers.length > 0 && !allSelected && <span className="text-foreground">({selectedUsers.length} selected)</span>}
          </label>
        )}
        {users.map(renderUserCard)}
      </div>
    )
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-muted-foreground">Approve, reject, change roles or manage user accounts</p>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative min-w-0">
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            {/* Equal-width tabs so Students no longer runs off the screen on phones */}
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              <TabsTrigger value="admins" className="px-2 text-xs sm:px-3 sm:text-sm"><Users className="hidden h-4 w-4 mr-1 sm:inline" /> Admins ({admins.length})</TabsTrigger>
              <TabsTrigger value="lecturers" className="px-2 text-xs sm:px-3 sm:text-sm"><Users className="hidden h-4 w-4 mr-1 sm:inline" /> Lecturers ({lecturers.length})</TabsTrigger>
              <TabsTrigger value="students" className="px-2 text-xs sm:px-3 sm:text-sm"><Users className="hidden h-4 w-4 mr-1 sm:inline" /> Students ({students.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="admins">{renderUserList(admins, 'admins')}</TabsContent>
            <TabsContent value="lecturers">{renderUserList(lecturers, 'lecturers')}</TabsContent>
            <TabsContent value="students">{renderUserList(students, 'students')}</TabsContent>
          </Tabs>
        )}

        {/* Bulk action bar */}
        {(selectedUsers.length > 0 || bulk) && (
          <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-xl border bg-background p-3 shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-[min(42rem,calc(100%-2rem))] sm:-translate-x-1/2">
            {bulk ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {bulk.label} {bulk.done}/{bulk.total}
                </div>
                <Progress value={(bulk.done / bulk.total) * 100} />
                <p className="text-xs text-muted-foreground">Keep this page open until it finishes.</p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm font-medium">{selectedUsers.length} selected</span>
                <Button size="sm" onClick={() => bulkStatus('approved')}><Check className="mr-1 h-4 w-4" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => bulkStatus('rejected')}><X className="mr-1 h-4 w-4" />Reject</Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            )}
          </div>
        )}
        {selectedUsers.length > 0 && <div className="h-20" aria-hidden />}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedUsers.length} users permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                Their accounts, enrollments, votes and everything linked to them will be removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={bulkDelete} className="bg-destructive hover:bg-destructive/90">Delete {selectedUsers.length}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '', content: '', type: 'general' as string,
    audience: 'general',
    department_id: '', level_id: '', course_id: ''
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchMeta();
  }, []);

  const fetchMeta = async () => {
    const [subjectsRes, classesRes, coursesRes] = await Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('courses').select('id, name, description, subjects(name), classes(name)').order('name'),
    ]);
    setSubjects(subjectsRes.data || []);
    setClasses(classesRes.data || []);
    setCourses(coursesRes.data || []);
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(full_name, role), subjects:department_id(name), classes:level_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const createAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    try {
      const insertData: any = {
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        type: newAnnouncement.type,
        author_id: profile?.id,
      };

      if (newAnnouncement.audience === 'department' && newAnnouncement.department_id) {
        insertData.department_id = newAnnouncement.department_id;
        if (newAnnouncement.level_id) insertData.level_id = newAnnouncement.level_id;
        insertData.type = 'subject';
      } else if (newAnnouncement.audience === 'course' && newAnnouncement.course_id) {
        insertData.course_id = newAnnouncement.course_id;
        insertData.type = 'class';
      }

      const { error } = await (supabase as any).from('announcements').insert([insertData]);
      if (error) throw error;

      toast({ title: "Announcement created", description: "Your announcement has been posted." });
      setNewAnnouncement({ title: '', content: '', type: 'general', audience: 'general', department_id: '', level_id: '', course_id: '' });
      setIsCreating(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Announcement removed." });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const typeOptions = [
    { value: 'general', label: 'General' },
    { value: 'academic', label: 'Academic' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const audienceOptions = [
    { value: 'general', label: 'Everyone' },
    { value: 'department', label: 'Department-based' },
    { value: 'course', label: 'Course-based' },
  ];

  const departmentOptions = subjects.map((s: any) => ({ value: s.id, label: s.name, description: s.code }));
  const levelOptions = [{ value: '', label: 'All Levels' }, ...classes.map((c: any) => ({ value: c.id, label: c.name }))];
  const courseOptions = courses.map((c: any) => ({
    value: c.id,
    label: c.name || c.description || c.id,
    description: `${c.subjects?.name || ''} • ${c.classes?.name || ''}`,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">Create and manage announcements</p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader><CardTitle>Create New Announcement</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Announcement title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement(p => ({ ...p, title: e.target.value }))} />
              <Textarea placeholder="Announcement content" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement(p => ({ ...p, content: e.target.value }))} rows={4} />
              
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <SearchableSelect
                    options={typeOptions}
                    value={newAnnouncement.type}
                    onValueChange={(v) => setNewAnnouncement(p => ({ ...p, type: v || 'general' }))}
                    placeholder="Select type"
                    searchPlaceholder="Search type..."
                  />
                  <SearchableSelect
                    options={audienceOptions}
                    value={newAnnouncement.audience}
                    onValueChange={(v) => setNewAnnouncement(p => ({ ...p, audience: v || 'general', department_id: '', level_id: '', course_id: '' }))}
                    placeholder="Select audience"
                    searchPlaceholder="Search audience..."
                  />
                </div>

                {newAnnouncement.audience === 'department' && (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <SearchableSelect
                      options={departmentOptions}
                      value={newAnnouncement.department_id}
                      onValueChange={(v) => setNewAnnouncement(p => ({ ...p, department_id: v }))}
                      placeholder="Select Department"
                      searchPlaceholder="Search departments..."
                    />
                    <SearchableSelect
                      options={levelOptions}
                      value={newAnnouncement.level_id}
                      onValueChange={(v) => setNewAnnouncement(p => ({ ...p, level_id: v }))}
                      placeholder="Level (optional)"
                      searchPlaceholder="Search levels..."
                    />
                  </div>
                )}

                {newAnnouncement.audience === 'course' && (
                  <SearchableSelect
                    options={courseOptions}
                    value={newAnnouncement.course_id}
                    onValueChange={(v) => setNewAnnouncement(p => ({ ...p, course_id: v }))}
                    placeholder="Select Course"
                    searchPlaceholder="Search courses..."
                  />
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={createAnnouncement}>Create</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 shrink-0" />
                      {a.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant={a.type === 'urgent' ? 'destructive' : a.type === 'academic' ? 'default' : 'secondary'}>
                        {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                      </Badge>
                      {a.subjects?.name && <Badge variant="outline">Dept: {a.subjects.name}</Badge>}
                      {a.classes?.name && <Badge variant="outline">Level: {a.classes.name}</Badge>}
                      {a.profiles?.role && (
                        <Badge variant={a.profiles.role === 'admin' ? 'default' : 'outline'}>
                          {a.profiles.role === 'admin' ? 'Admin' : 'Lecturer'}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {a.profiles?.full_name} • {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => deleteAnnouncement(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

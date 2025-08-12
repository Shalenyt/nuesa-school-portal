import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Edit2, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    type: 'global' as 'global' | 'class' | 'subject'
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .insert([{
          title: newAnnouncement.title.trim(),
          content: newAnnouncement.content.trim(),
          type: newAnnouncement.type,
          author_id: profile?.id
        }]);

      if (error) throw error;

      toast({
        title: "Announcement created",
        description: "Your announcement has been posted successfully.",
      });

      setNewAnnouncement({ title: '', content: '', type: 'global' });
      setIsCreating(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Announcement deleted",
        description: "Announcement has been removed successfully.",
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">
              Create and manage school announcements
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Announcement title"
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Announcement content"
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
              <Select
                value={newAnnouncement.type}
                onValueChange={(value: any) => setNewAnnouncement(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select announcement type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="subject">Subject</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button onClick={createAnnouncement}>Create</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {announcement.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        announcement.type === 'urgent' ? 'destructive' :
                        announcement.type === 'academic' ? 'default' :
                        'secondary'
                      }>
                        {announcement.type.charAt(0).toUpperCase() + announcement.type.slice(1)}
                      </Badge>
                      {announcement.profiles?.role && (
                        <Badge variant={announcement.profiles.role === 'admin' ? 'default' : 'outline'}>
                          {announcement.profiles.role === 'admin' ? 'Admin' : 'Teacher'}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {announcement.profiles?.full_name} • {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAnnouncement(announcement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {announcement.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
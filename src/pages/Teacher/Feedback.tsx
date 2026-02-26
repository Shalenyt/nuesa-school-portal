import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send } from 'lucide-react';

export default function TeacherFeedback() {
  const { profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'feedback' | 'complaint'>('feedback');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || !profile) {
      toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from('feedback').insert({
      user_id: profile.id,
      subject: subject.trim(),
      message: message.trim(),
      type,
      is_anonymous: isAnonymous,
      user_role: profile.role,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Submitted', description: 'Your feedback has been sent to the admin.' });
      setSubject('');
      setMessage('');
      setType('feedback');
      setIsAnonymous(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback & Complaints</h1>
          <p className="text-muted-foreground">Submit feedback or complaints to the administration</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Submit Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: 'feedback' | 'complaint') => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief subject line" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your feedback or complaint in detail..." rows={5} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              <Label>Submit Anonymously</Label>
            </div>
            <Button onClick={handleSubmit} disabled={submitting}>
              <Send className="h-4 w-4 mr-2" /> {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, BookOpen, Calendar, CheckCircle, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function StudentSubmitAssignment() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) { setLoading(false); return; }

      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('department_id, level_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.department_id || !profile?.level_id) { setLoading(false); return; }

      const { data: courseListData } = await (supabase as any)
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      if (!courseListData?.course_ids || courseListData.course_ids.length === 0) { setLoading(false); return; }

      // Fetch assignments and existing submissions in parallel
      const [assignmentsRes, submissionsRes] = await Promise.all([
        (supabase as any)
          .from('assignments')
          .select(`*, courses(subject_id, class_id, subjects(name))`)
          .in('course_id', courseListData.course_ids),
        supabase
          .from('assignment_submissions')
          .select('assignment_id, id, grade, graded_at, submitted_at')
          .eq('student_id', userId)
      ]);

      const allAssignments = (assignmentsRes.data || []).map((a: any) => ({
        ...a,
        courseName: a.courses?.subjects?.name
      }));

      setAssignments(allAssignments);
      setSubmissions(submissionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubmission = (assignmentId: string) =>
    submissions.find((s) => s.assignment_id === assignmentId);

  const pendingAssignments = assignments.filter((a) => !getSubmission(a.id));
  const completedAssignments = assignments.filter((a) => getSubmission(a.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) {
      toast({ title: "Error", description: "Please select an assignment.", variant: "destructive" });
      return;
    }
    if (!submissionText.trim() && !file) {
      toast({ title: "Error", description: "Please provide text or upload a file.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = null;
      let fileName = null;

      if (file) {
        const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) throw new Error('Invalid file type.');
        if (file.size > MAX_FILE_SIZE) throw new Error('File too large. Max 10MB.');

        const userId = (await supabase.auth.getUser()).data.user?.id;
        const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('assignments').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('assignments').getPublicUrl(filePath);
        fileUrl = publicUrl;
        fileName = file.name;
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from('assignment_submissions')
        .insert([{
          assignment_id: selectedAssignment,
          student_id: userId,
          submission_text: submissionText.trim() || null,
          file_url: fileUrl,
          file_name: fileName
        }]);

      if (error) throw error;

      toast({ title: "Assignment submitted", description: "Your assignment has been submitted successfully." });
      setSelectedAssignment('');
      setSubmissionText('');
      setFile(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Submit Assignment</h1>
          <p className="text-muted-foreground">Submit your assignments for enrolled courses</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assignment Submission</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Assignment</label>
                <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pending assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingAssignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.title} - {assignment.courseName}
                        {assignment.due_date && ` (Due: ${new Date(assignment.due_date).toLocaleDateString()})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Submission</label>
                <Textarea placeholder="Enter your assignment text here..." value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} rows={6} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">File Upload (Optional)</label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" />
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB)</p>
              </div>
              <Button type="submit" disabled={submitting || pendingAssignments.length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Assignment'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No assignments available</h3>
                <p className="mt-1 text-sm text-muted-foreground">Update your department and level in your profile, or no assignments have been posted yet.</p>
              </div>
            ) : (
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">
                    <Clock className="h-4 w-4 mr-1" /> Pending ({pendingAssignments.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    <CheckCircle className="h-4 w-4 mr-1" /> Completed ({completedAssignments.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                  {pendingAssignments.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">All assignments submitted!</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingAssignments.map((a) => (
                        <div key={a.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                {a.title}
                                <Badge variant="outline" className="text-orange-600 border-orange-300">Pending</Badge>
                              </h4>
                              <p className="text-sm text-muted-foreground">{a.courseName}</p>
                              {a.description && <p className="text-sm mt-1">{a.description}</p>}
                            </div>
                            {a.due_date && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {new Date(a.due_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="completed">
                  {completedAssignments.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No completed assignments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {completedAssignments.map((a) => {
                        const sub = getSubmission(a.id);
                        return (
                          <div key={a.id} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium flex items-center gap-2">
                                  {a.title}
                                  {sub?.grade != null ? (
                                    <Badge className="bg-green-600 text-white">Graded: {sub.grade}/{a.max_points || 100}</Badge>
                                  ) : (
                                    <Badge variant="secondary">Submitted</Badge>
                                  )}
                                </h4>
                                <p className="text-sm text-muted-foreground">{a.courseName}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Submitted: {new Date(sub?.submitted_at).toLocaleDateString()}
                                </p>
                              </div>
                              {a.due_date && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due: {new Date(a.due_date).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

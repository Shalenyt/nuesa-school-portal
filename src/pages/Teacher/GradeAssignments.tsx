import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Download, Eye, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function GradeAssignments() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({
    grade: '',
    feedback: ''
  });
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [profile]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          assignments(
            title,
            courses(
              name,
              classes(name),
              subjects(name)
            )
          ),
          profiles(full_name, student_id)
        `)
        .eq('assignments.courses.teacher_id', profile?.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const gradeSubmission = async () => {
    if (!selectedSubmission || !gradeForm.grade) {
      toast({
        title: "Error",
        description: "Please enter a grade.",
        variant: "destructive"
      });
      return;
    }

    setGrading(true);

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: parseFloat(gradeForm.grade),
          feedback: gradeForm.feedback,
          graded_at: new Date().toISOString(),
          status: 'graded'
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast({
        title: "Assignment graded",
        description: "Grade has been submitted successfully.",
      });

      setSelectedSubmission(null);
      setGradeForm({ grade: '', feedback: '' });
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGrading(false);
    }
  };

  const downloadSubmission = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('assignments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file.",
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grade Assignments</h1>
          <p className="text-muted-foreground">
            Review and grade student submissions
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Submissions ({submissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSubmission?.id === submission.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedSubmission(submission)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{submission.assignments?.title}</h3>
                    <Badge variant={submission.status === 'graded' ? 'default' : 'secondary'}>
                      {submission.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Student: {submission.profiles?.full_name} ({submission.profiles?.student_id})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Course: {submission.assignments?.courses?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                  {submission.grade && (
                    <p className="text-sm font-medium text-green-600 mt-1">
                      Grade: {submission.grade}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {selectedSubmission && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Grade Submission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">{selectedSubmission.assignments?.title}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    Student: {selectedSubmission.profiles?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}
                  </p>
                  
                  {selectedSubmission.file_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSubmission(selectedSubmission.file_path, selectedSubmission.file_name)}
                      className="mb-4"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Submission
                    </Button>
                  )}

                  {selectedSubmission.content && (
                    <div className="mb-4">
                      <label className="text-sm font-medium">Submission Content:</label>
                      <div className="mt-1 p-3 bg-muted rounded border">
                        <p className="text-sm whitespace-pre-wrap">{selectedSubmission.content}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Grade (0-100)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Enter grade"
                      value={gradeForm.grade}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Feedback</label>
                    <Textarea
                      placeholder="Enter feedback for the student"
                      value={gradeForm.feedback}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <Button onClick={gradeSubmission} disabled={grading} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {grading ? 'Submitting Grade...' : 'Submit Grade'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
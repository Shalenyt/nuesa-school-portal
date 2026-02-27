import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Download, Eye, CheckCircle, ArrowLeft, User } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase as sb } from '@/integrations/supabase/client';

export default function GradeAssignments() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({
    grade: '',
    feedback: ''
  });
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [view, setView] = useState<'assignments' | 'submissions' | 'grading'>('assignments');

  useEffect(() => {
    fetchAssignments();
  }, [profile]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          courses!inner(
            name,
            teacher_id,
            classes(name),
            subjects(name)
          )
        `)
        .eq('courses.teacher_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          profiles!assignment_submissions_student_id_fkey(full_name, student_id, profile_photo_url)
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
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

    const maxPoints = selectedAssignment?.max_points || 100;
    const grade = parseFloat(gradeForm.grade);
    
    if (grade > maxPoints) {
      toast({
        title: "Error",
        description: `Grade cannot exceed ${maxPoints} points.`,
        variant: "destructive"
      });
      return;
    }

    setGrading(true);

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: grade,
          feedback: gradeForm.feedback,
          graded_at: new Date().toISOString(),
          graded_by: profile?.id
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      // Notify the student
      await supabase.from('notifications').insert({
        user_id: selectedSubmission.student_id,
        title: 'Assignment Graded',
        message: `Your submission for "${selectedAssignment?.title}" has been graded. Score: ${grade}/${selectedAssignment?.max_points || 100}.`,
        type: 'grade',
        is_read: false,
      });

      toast({
        title: "Assignment graded",
        description: "Grade has been submitted successfully.",
      });

      setView('submissions');
      setSelectedSubmission(null);
      setGradeForm({ grade: '', feedback: '' });
      fetchSubmissions(selectedAssignment.id);
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

  const handleAssignmentSelect = (assignment: any) => {
    setSelectedAssignment(assignment);
    setView('submissions');
    fetchSubmissions(assignment.id);
  };

  const handleSubmissionSelect = (submission: any) => {
    setSelectedSubmission(submission);
    setGradeForm({
      grade: submission.grade?.toString() || '',
      feedback: submission.feedback || ''
    });
    setView('grading');
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
        <div className="flex items-center gap-4">
          {view !== 'assignments' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (view === 'grading') {
                  setView('submissions');
                  setSelectedSubmission(null);
                } else {
                  setView('assignments');
                  setSelectedAssignment(null);
                  setSubmissions([]);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Grade Assignments</h1>
            <p className="text-muted-foreground">
              {view === 'assignments' && 'Select an assignment to view submissions'}
              {view === 'submissions' && `Submissions for "${selectedAssignment?.title}"`}
              {view === 'grading' && 'Grade student submission'}
            </p>
          </div>
        </div>

        {view === 'assignments' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => (
              <Card
                key={assignment.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleAssignmentSelect(assignment)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    {assignment.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {assignment.courses?.name} • {assignment.courses?.classes?.name}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">{assignment.description}</p>
                    <div className="flex justify-between items-center">
                      <Badge variant="outline">
                        Max: {assignment.max_points || 100} pts
                      </Badge>
                      {assignment.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {view === 'submissions' && (() => {
          const pendingSubmissions = submissions.filter(s => !s.grade && s.grade !== 0);
          const gradedSubmissions = submissions.filter(s => s.grade !== null && s.grade !== undefined);
          
          const renderSubmissionCards = (items: any[]) => (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((submission) => (
                <Card
                  key={submission.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSubmissionSelect(submission)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={submission.profiles?.profile_photo_url} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium">{submission.profiles?.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {submission.profiles?.student_id}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge variant={submission.grade !== null && submission.grade !== undefined ? 'default' : 'secondary'}>
                          {submission.grade !== null && submission.grade !== undefined ? `${submission.grade}/${selectedAssignment?.max_points || 100}` : 'Not graded'}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      {submission.file_name && (
                        <p className="text-sm text-muted-foreground truncate">
                          📎 {submission.file_name}
                        </p>
                      )}
                      {submission.submission_text && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {submission.submission_text}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No submissions in this category.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          );

          return (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                  Pending {pendingSubmissions.length > 0 && <Badge variant="secondary" className="ml-2">{pendingSubmissions.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="graded">
                  Graded {gradedSubmissions.length > 0 && <Badge variant="secondary" className="ml-2">{gradedSubmissions.length}</Badge>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                {renderSubmissionCards(pendingSubmissions)}
              </TabsContent>
              <TabsContent value="graded">
                {renderSubmissionCards(gradedSubmissions)}
              </TabsContent>
            </Tabs>
          );
        })()}

        {view === 'grading' && selectedSubmission && (
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Grade Submission
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={selectedSubmission.profiles?.profile_photo_url} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{selectedSubmission.profiles?.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ID: {selectedSubmission.profiles?.student_id} • 
                      Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedSubmission.file_url && (
                  <div>
                    <label className="text-sm font-medium">Submitted File:</label>
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => downloadSubmission(selectedSubmission.file_url, selectedSubmission.file_name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download {selectedSubmission.file_name}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedSubmission.submission_text && (
                  <div>
                    <label className="text-sm font-medium">Submission Text:</label>
                    <div className="mt-2 p-4 bg-muted rounded-lg border">
                      <p className="text-sm whitespace-pre-wrap">{selectedSubmission.submission_text}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">
                      Grade (0-{selectedAssignment?.max_points || 100})
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedAssignment?.max_points || 100}
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
                      rows={3}
                    />
                  </div>
                </div>

                <Button onClick={gradeSubmission} disabled={grading} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {grading ? 'Submitting Grade...' : 'Submit Grade'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {assignments.length === 0 && view === 'assignments' && !loading && (
          <Card>
            <CardContent className="text-center py-8">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No assignments found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
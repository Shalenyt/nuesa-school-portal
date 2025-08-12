import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, BookOpen, Calendar } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function StudentSubmitAssignment() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Get user profile to check department and level
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id, level_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.department_id || !profile?.level_id) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Get courses from course lists based on student's department and level  
      const { data: courseListData, error: courseListError } = await supabase
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      console.log('Course list data:', courseListData, 'Error:', courseListError);

      if (!courseListData?.course_ids || courseListData.course_ids.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Get assignments for those courses
      console.log('Fetching assignments for course IDs:', courseListData.course_ids);
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          courses(name, subject_id, class_id)
        `)
        .in('course_id', courseListData.course_ids);

      console.log('Assignments query result:', assignmentsData, 'Error:', assignmentsError);

      const allAssignments = assignmentsData?.map(assignment => ({
        ...assignment,
        courseName: assignment.courses?.name
      })) || [];

      setAssignments(allAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAssignment) {
      toast({
        title: "Error",
        description: "Please select an assignment.",
        variant: "destructive"
      });
      return;
    }

    if (!submissionText.trim() && !file) {
      toast({
        title: "Error",
        description: "Please provide either text submission or upload a file.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      let fileUrl = null;
      let fileName = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assignments')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = file.name;
      }

      // Submit assignment
      const { error } = await supabase
        .from('assignment_submissions')
        .insert([{
          assignment_id: selectedAssignment,
          student_id: (await supabase.auth.getUser()).data.user?.id,
          submission_text: submissionText.trim() || null,
          file_url: fileUrl,
          file_name: fileName
        }]);

      if (error) throw error;

      toast({
        title: "Assignment submitted",
        description: "Your assignment has been submitted successfully.",
      });

      // Reset form
      setSelectedAssignment('');
      setSubmissionText('');
      setFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Submit Assignment</h1>
          <p className="text-muted-foreground">
            Submit your assignments for enrolled courses
          </p>
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
                    <SelectValue placeholder="Choose an assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          {assignment.title} - {assignment.courseName}
                          {assignment.due_date && (
                            <span className="text-xs text-muted-foreground">
                              (Due: {new Date(assignment.due_date).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Text Submission</label>
                <Textarea
                  placeholder="Enter your assignment text here..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">File Upload (Optional)</label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB)
                </p>
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Assignment
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Available Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>Available Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No assignments available</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please update your department and level in your profile, or no assignments have been posted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{assignment.title}</h4>
                        <p className="text-sm text-muted-foreground">{assignment.courseName}</p>
                        {assignment.description && (
                          <p className="text-sm mt-1">{assignment.description}</p>
                        )}
                      </div>
                      {assignment.due_date && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
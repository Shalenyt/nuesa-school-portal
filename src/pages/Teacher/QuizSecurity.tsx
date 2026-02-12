import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Monitor, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function QuizSecurity() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [violations, setViolations] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchQuizzes();
  }, [profile]);

  const fetchQuizzes = async () => {
    const { data } = await (supabase as any)
      .from('quizzes')
      .select('id, title, courses(name)')
      .eq('created_by', profile?.id)
      .order('created_at', { ascending: false });
    setQuizzes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedQuizId) {
      fetchSecurityData(selectedQuizId);
    }
  }, [selectedQuizId]);

  const fetchSecurityData = async (quizId: string) => {
    const [{ data: violationsData }, { data: subsData }] = await Promise.all([
      (supabase as any)
        .from('quiz_violation_logs')
        .select('*, profiles!quiz_violation_logs_student_id_fkey(full_name, student_id)')
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('quiz_submissions')
        .select('*, profiles!quiz_submissions_student_id_fkey(full_name, student_id)')
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false }),
    ]);
    setViolations(violationsData || []);
    setSubmissions(subsData || []);
  };

  const getViolationColor = (type: string) => {
    switch (type) {
      case 'tab_switch': return 'destructive';
      case 'focus_loss': return 'destructive';
      case 'copy_attempt': return 'secondary';
      case 'fullscreen_exit': return 'secondary';
      case 'devtools_open': return 'destructive';
      case 'quiz_start': return 'outline';
      default: return 'outline';
    }
  };

  // Aggregate violations per student
  const studentSummary = submissions.map(sub => {
    const studentViolations = violations.filter(v => 
      v.student_id === sub.student_id && v.violation_type !== 'quiz_start'
    );
    const tabSwitches = studentViolations.filter(v => v.violation_type === 'tab_switch' || v.violation_type === 'focus_loss').length;
    const copyAttempts = studentViolations.filter(v => v.violation_type === 'copy_attempt').length;
    
    return {
      ...sub,
      totalViolations: studentViolations.length,
      tabSwitches,
      copyAttempts,
      suspicious: tabSwitches >= 2 || studentViolations.length >= 3,
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" /> Quiz Security Monitor
          </h1>
          <p className="text-muted-foreground text-sm">Review student behavior during quiz attempts</p>
        </div>

        <div className="max-w-sm">
          <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a quiz to review" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map(q => (
                <SelectItem key={q.id} value={q.id}>{q.title} ({q.courses?.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedQuizId && (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">
                Student Summary
                {studentSummary.filter(s => s.suspicious).length > 0 && (
                  <Badge variant="destructive" className="ml-2">{studentSummary.filter(s => s.suspicious).length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="violations">
                Violation Log ({violations.filter(v => v.violation_type !== 'quiz_start').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Matric NO</TableHead>
                        <TableHead>Tab Switches</TableHead>
                        <TableHead>Copy Attempts</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentSummary.map(s => (
                        <TableRow key={s.id} className={s.suspicious ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium">{s.profiles?.full_name}</TableCell>
                          <TableCell>{s.profiles?.student_id || '—'}</TableCell>
                          <TableCell>
                            {s.tabSwitches > 0 ? (
                              <Badge variant="destructive">{s.tabSwitches}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.copyAttempts > 0 ? (
                              <Badge variant="secondary">{s.copyAttempts}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.latitude && s.longitude ? (
                              <span className="text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {s.device_info?.platform ? (
                              <span className="text-xs flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                {s.device_info.platform}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {s.suspicious ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" /> Suspicious
                              </Badge>
                            ) : (
                              <Badge variant="outline">Clean</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {studentSummary.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No submissions yet for this quiz.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="violations">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Violation</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violations.filter(v => v.violation_type !== 'quiz_start').map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.profiles?.full_name}</TableCell>
                          <TableCell>
                            <Badge variant={getViolationColor(v.violation_type) as any}>
                              {v.violation_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {v.details?.key ? `Key: ${v.details.key}` : v.details?.method || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {violations.filter(v => v.violation_type !== 'quiz_start').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No violations recorded for this quiz.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {!selectedQuizId && !loading && (
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select a quiz above to view security data.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

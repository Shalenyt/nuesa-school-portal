import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';

interface RankedStudent {
  id: string;
  name: string;
  studentId: string;
  score: number;
  rank: number;
  courses?: string[];
}

export default function Rankings() {
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [courseRankings, setCourseRankings] = useState<RankedStudent[]>([]);
  const [deptRankings, setDeptRankings] = useState<RankedStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      const [{ data: deptsData }, { data: levelsData }] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('classes').select('id, name, grade_level'),
      ]);
      setDepartments(deptsData || []);
      setLevels(levelsData || []);
      setLoading(false);
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (!loading) fetchRankings();
  }, [selectedDept, selectedLevel, loading]);

  const fetchRankings = async () => {
    // Fetch quiz scores and assignments for course-based rankings
    const { data: quizData } = await supabase
      .from('quiz_submissions')
      .select('student_id, score, quiz_id, quizzes(course_id, course:courses(name, subject_id, class_id))')
      .order('score', { ascending: false });

    // For department ranking, filter by selected department/level
    let courseQuery = supabase.from('courses').select('id, name, subject_id, class_id, subject:subjects(name), class:classes(name)');
    
    if (selectedDept !== 'all') {
      courseQuery = courseQuery.eq('subject_id', selectedDept);
    }
    if (selectedLevel !== 'all') {
      courseQuery = courseQuery.eq('class_id', selectedLevel);
    }

    const { data: courseData } = await courseQuery;

    // Group scores by student
    const studentScores: { [key: string]: { scores: number[]; name: string; studentId: string; courses: string[] } } = {};

    (quizData || []).forEach((quiz: any) => {
      const courseId = quiz.quizzes?.course_id;
      const course = courseData?.find((c: any) => c.id === courseId);
      
      if (!course) return;
      if (selectedDept !== 'all' && course.subject_id !== selectedDept) return;
      if (selectedLevel !== 'all' && course.class_id !== selectedLevel) return;

      if (!studentScores[quiz.student_id]) {
        studentScores[quiz.student_id] = { scores: [], name: '', studentId: '', courses: [] };
      }
      studentScores[quiz.student_id].scores.push(quiz.score || 0);
      if (!studentScores[quiz.student_id].courses.includes(course.name)) {
        studentScores[quiz.student_id].courses.push(course.name);
      }
    });

    // Fetch student names
    const studentIds = Object.keys(studentScores);
    if (studentIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, student_id')
        .in('id', studentIds);

      profileData?.forEach((profile: any) => {
        if (studentScores[profile.id]) {
          studentScores[profile.id].name = profile.full_name;
          studentScores[profile.id].studentId = profile.student_id;
        }
      });
    }

    // Calculate averages and create rankings
    const rankings = Object.entries(studentScores)
      .map(([id, data]) => ({
        id,
        name: data.name,
        studentId: data.studentId,
        score: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100,
        rank: 0,
        courses: data.courses,
      }))
      .sort((a, b) => b.score - a.score)
      .map((student, idx) => ({ ...student, rank: idx + 1 }));

    setCourseRankings(rankings);
    setDeptRankings(rankings);
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-orange-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  const RankingTable = ({ data, title }: { data: RankedStudent[]; title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No rankings available</p>
        ) : (
          <div className="space-y-2">
            {data.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  {getMedalIcon(student.rank)}
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge>{student.score.toFixed(1)}%</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{student.courses?.length || 0} courses</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rankings</h1>
          <p className="text-muted-foreground">View student rankings by course and department</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter Rankings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Department</label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Level</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name} (Grade {level.grade_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <RankingTable data={courseRankings} title="Course-Based Rankings" />
        <RankingTable data={deptRankings} title="Department Rankings" />
      </div>
    </DashboardLayout>
  );
}

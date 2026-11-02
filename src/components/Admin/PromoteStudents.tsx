import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateStudentGPA } from '@/lib/gpa';
import { logAudit } from '@/lib/audit';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { GraduationCap, Loader2 } from 'lucide-react';

/** Students at or above this CGPA are ticked automatically (NUC probation line). */
const MIN_CGPA = 1.0;

type Row = {
  id: string;
  full_name: string;
  student_id: string | null;
  department_id: string | null;
  level_id: string | null;
  levelName: string;
  levelNumber: number | null;
  departmentName: string;
  cgpa: number | null; // null = no graded results yet
};

const levelNumber = (name?: string | null) => {
  const m = name?.match(/\d{3}/);
  return m ? Number(m[0]) : null;
};

/**
 * End-of-session promotion. The admin sees every approved student with their
 * CGPA; those at 1.00 or above are pre-ticked and the admin can change any
 * tick before confirming. Promoting moves a student to the next level, which
 * switches their courses, timetable and lecturers to that level. Their past
 * results stay on record. 500 level students are final year and are not moved.
 */
export function PromoteStudents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [levelFilter, setLevelFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const [{ data: students }, { data: levels }, { data: depts }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_id, department_id, level_id')
        .eq('role', 'student').eq('status', 'approved').order('full_name'),
      supabase.from('classes').select('id, name'),
      supabase.from('subjects').select('id, name'),
    ]);
    const levelMap = new Map((levels || []).map((l) => [l.id, l.name]));
    const deptMap = new Map((depts || []).map((d) => [d.id, d.name]));

    const withGpa = await Promise.all((students || []).map(async (s) => {
      let cgpa: number | null = null;
      try {
        const r = await calculateStudentGPA(s.id);
        cgpa = r.courseGrades.length ? r.gpa : null;
      } catch { cgpa = null; }
      const levelName = (s.level_id && levelMap.get(s.level_id)) || 'No level';
      return {
        ...s,
        levelName,
        levelNumber: levelNumber(levelName),
        departmentName: (s.department_id && deptMap.get(s.department_id)) || 'No department',
        cgpa,
      } as Row;
    }));

    setRows(withGpa);
    // Pre-tick students who can move up and have a CGPA of 1.00 or above
    setSelected(new Set(withGpa
      .filter((r) => r.levelNumber !== null && r.levelNumber < 500 && r.cgpa !== null && r.cgpa >= MIN_CGPA)
      .map((r) => r.id)));
    setLoaded(true);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((r) =>
    (levelFilter === 'all' || r.level_id === levelFilter) &&
    (deptFilter === 'all' || r.department_id === deptFilter)
  ), [rows, levelFilter, deptFilter]);

  const levelOptions = useMemo(() => [...new Map(rows.filter(r => r.level_id).map(r => [r.level_id!, r.levelName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const deptOptions = useMemo(() => [...new Map(rows.filter(r => r.department_id).map(r => [r.department_id!, r.departmentName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [rows]);

  const canPromote = (r: Row) => r.levelNumber !== null && r.levelNumber < 500;
  const selectedCount = rows.filter((r) => selected.has(r.id) && canPromote(r)).length;

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.filter(canPromote).forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  const promote = async () => {
    const ids = rows.filter((r) => selected.has(r.id) && canPromote(r)).map((r) => r.id);
    if (!ids.length) return;
    setPromoting(true);
    const { data, error } = await (supabase as any).rpc('promote_students', { p_student_ids: ids });
    setPromoting(false);
    if (error) {
      toast({ title: 'Promotion failed', description: error.message, variant: 'destructive' });
      return;
    }
    const moved = typeof data === 'number' ? data : ids.length;
    logAudit({
      action: 'update',
      resourceType: 'student',
      description: `Promoted ${moved} student(s) to the next level`,
      metadata: { student_ids: ids },
    });
    toast({ title: 'Students promoted', description: `${moved} student(s) moved to their next level.` });
    load();
  };

  const allVisibleTicked = visible.filter(canPromote).length > 0 && visible.filter(canPromote).every((r) => selected.has(r.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Promote Students to Next Level
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Use this at the end of a session. Students with a CGPA of {MIN_CGPA.toFixed(2)} or above are ticked
          automatically; change any tick before confirming. Promoted students get the next level's courses,
          timetable and lecturers, and keep their past results. 500 level students are final year and are not moved.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !loaded ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students and CGPAs...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved students yet.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levelOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {deptOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={allVisibleTicked} onCheckedChange={(v) => toggleAllVisible(v === true)} />
              Select all shown
            </label>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {visible.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${canPromote(r) ? 'cursor-pointer' : 'opacity-60'}`}
                >
                  <Checkbox
                    checked={selected.has(r.id) && canPromote(r)}
                    disabled={!canPromote(r)}
                    onCheckedChange={(v) => toggle(r.id, v === true)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.student_id || 'No matric'} · {r.departmentName} · {r.levelName}
                      {canPromote(r) && ` → ${r.levelNumber! + 100} LEVEL`}
                    </p>
                  </div>
                  {r.levelNumber === 500 ? (
                    <Badge variant="secondary">Final year</Badge>
                  ) : r.cgpa === null ? (
                    <Badge variant="outline">No results yet</Badge>
                  ) : (
                    <Badge variant={r.cgpa >= MIN_CGPA ? 'default' : 'destructive'}>CGPA {r.cgpa.toFixed(2)}</Badge>
                  )}
                </label>
              ))}
              {visible.length === 0 && <p className="text-sm text-muted-foreground">No students match these filters.</p>}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={selectedCount === 0 || promoting}>
                  {promoting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Promote {selectedCount} student{selectedCount === 1 ? '' : 's'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Promote {selectedCount} student{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Each ticked student moves up one level and gets that level's courses, timetable and lecturers.
                    Their past results are kept. To undo, you would have to change each student's level by hand.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={promote}>Promote</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}

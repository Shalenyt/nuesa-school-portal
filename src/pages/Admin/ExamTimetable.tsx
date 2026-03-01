import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, Edit2, Download, Eye, Search, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TIME_SLOTS = {
  morning: { label: 'Morning (8:00 AM – 11:00 AM)', start: '08:00', end: '11:00' },
  afternoon: { label: 'Afternoon (11:30 AM – 2:30 PM)', start: '11:30', end: '14:30' },
  evening: { label: 'Evening (3:00 PM – 5:00 PM)', start: '15:00', end: '17:00' },
};

export default function AdminExamTimetable() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSemester, setActiveSemester] = useState<any>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const timetableRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    day_label: '', exam_date: '', time_slot: 'morning',
    start_time: '08:00', end_time: '11:00',
    course_codes: [] as string[], venue: '',
  });

  useEffect(() => {
    fetchEntries();
    fetchSemester();
    fetchCoursesAndFilters();
    fetchHistory();
  }, []);

  const fetchSemester = async () => {
    const { data } = await supabase.from('semester_config').select('*').eq('is_active', true).maybeSingle();
    setActiveSemester(data);
  };

  const fetchCoursesAndFilters = async () => {
    const [coursesRes, deptsRes, levelsRes] = await Promise.all([
      supabase.from('courses').select('id, name, description, credit_unit, semester, academic_year, subjects(id, name, code), classes(id, name)').order('name'),
      supabase.from('subjects').select('id, name, code').order('name'),
      supabase.from('classes').select('id, name').order('name'),
    ]);
    setAllCourses(coursesRes.data || []);
    setDepartments(deptsRes.data || []);
    setLevels(levelsRes.data || []);
  };

  const fetchEntries = async () => {
    const { data } = await (supabase as any).from('exam_timetables').select('*').order('exam_date', { ascending: true }).order('time_slot', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data } = await (supabase as any).from('timetable_history').select('*').order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const courseOptions = useMemo(() => {
    let filtered = allCourses;
    if (filterDept) filtered = filtered.filter((c: any) => c.subjects?.id === filterDept);
    if (filterLevel) filtered = filtered.filter((c: any) => c.classes?.id === filterLevel);
    return filtered.map((c: any) => ({
      value: c.subjects?.code || c.name || c.id,
      label: c.subjects?.code || c.name || '',
      description: `${c.subjects?.name || c.name || ''} • ${c.classes?.name || ''} • ${c.credit_unit || 0} units`,
    }));
  }, [allCourses, filterDept, filterLevel]);

  const deptOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))];
  const levelOptions = [{ value: '', label: 'All Levels' }, ...levels.map((l: any) => ({ value: l.id, label: l.name }))];

  const semesterLabel = activeSemester ? `${activeSemester.name} Academic Session` : 'Academic Session';

  const resetForm = () => {
    setForm({ day_label: '', exam_date: '', time_slot: 'morning', start_time: '08:00', end_time: '11:00', course_codes: [], venue: '' });
    setEditingId(null);
    setIsCreating(false);
  };

  const handleTimeSlotChange = (slot: string) => {
    const s = TIME_SLOTS[slot as keyof typeof TIME_SLOTS];
    setForm(p => ({ ...p, time_slot: slot, start_time: s.start, end_time: s.end }));
  };

  const isFriday = (dateStr: string) => dateStr ? new Date(dateStr).getDay() === 5 : false;

  const addCourseCode = (code: string) => {
    if (!code) return;
    if (form.course_codes.includes(code)) {
      toast({ title: 'Duplicate', description: 'This course is already added.', variant: 'destructive' });
      return;
    }
    setForm(p => ({ ...p, course_codes: [...p.course_codes, code] }));
  };

  const removeCourseCode = (code: string) => {
    setForm(p => ({ ...p, course_codes: p.course_codes.filter(c => c !== code) }));
  };

  const saveEntry = async () => {
    if (!form.day_label || !form.exam_date || form.course_codes.length === 0) {
      toast({ title: 'Error', description: 'Day, date and at least one course are required.', variant: 'destructive' });
      return;
    }

    // Save each course as a separate entry
    for (const code of form.course_codes) {
      const payload = {
        day_label: form.day_label, exam_date: form.exam_date, time_slot: form.time_slot,
        start_time: form.start_time, end_time: form.end_time, course_code: code,
        venue: form.venue, created_by: profile?.id,
      };

      if (editingId && form.course_codes.length === 1) {
        const { created_by, ...updatePayload } = payload;
        const { error } = await (supabase as any).from('exam_timetables').update(updatePayload).eq('id', editingId);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      } else {
        const { error } = await (supabase as any).from('exam_timetables').insert([payload]);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      }

      try {
        await supabase.functions.invoke('exam-notifications', {
          body: { type: 'exam_created', course_code: code, exam_date: form.exam_date, time_slot: form.time_slot, venue: form.venue, start_time: form.start_time, end_time: form.end_time },
        });
      } catch (e) { console.error('Notification error:', e); }
    }

    toast({ title: editingId ? 'Updated' : 'Created', description: editingId ? 'Entry updated.' : `${form.course_codes.length} entries added.` });
    resetForm();
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    await (supabase as any).from('exam_timetables').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchEntries();
  };

  const startEdit = (e: any) => {
    setForm({
      day_label: e.day_label, exam_date: e.exam_date, time_slot: e.time_slot,
      start_time: e.start_time, end_time: e.end_time, course_codes: [e.course_code], venue: e.venue || '',
    });
    setEditingId(e.id);
    setIsCreating(true);
  };

  const saveTimetableHistory = async () => {
    if (!activeSemester || entries.length === 0) {
      toast({ title: 'Error', description: 'No timetable data or active semester.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('timetable_history').insert([{
      semester: activeSemester.name,
      session: activeSemester.name,
      timetable_data: entries,
      created_by: profile?.id,
    }]);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Saved', description: 'Timetable archived to history.' });
    fetchHistory();
  };

  const downloadPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  };

  const grouped = entries.reduce((acc: any, e: any) => {
    const dateObj = new Date(e.exam_date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const key = `${e.day_label}|${dayName}|${dateFormatted}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  const renderSlotCell = (items: any[], slotType: string, dateStr: string, readonly = false) => {
    if (slotType === 'afternoon' && new Date(dateStr).getDay() === 5) {
      return (<td className="border border-border p-2 text-center" colSpan={2}><span className="font-bold text-muted-foreground">FRIDAY PRAYER</span></td>);
    }
    if (items.length === 0) {
      return (<><td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td><td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td></>);
    }
    return (
      <>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (
              <div key={e.id || e.course_code} className="flex items-center justify-between gap-1">
                <span className="font-bold text-sm">{e.course_code}</span>
                {!readonly && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => startEdit(e)}><Edit2 className="h-3 w-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-5 w-5 p-0"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete this entry?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteEntry(e.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        </td>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (<div key={e.id || e.course_code} className="text-sm text-muted-foreground">{e.venue || '—'}</div>))}
          </div>
        </td>
      </>
    );
  };

  const renderTimetableTable = (data: Record<string, any>, readonly = false) => (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-primary text-primary-foreground">
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" rowSpan={2}>DAY & DATE</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>MORNING (8:00 – 11:00)</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>AFTERNOON (11:30 – 2:30)</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>EVENING (3:00 – 5:00)</th>
        </tr>
        <tr className="bg-primary/90 text-primary-foreground text-xs">
          <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
          <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
          <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
          <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
          <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
          <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([dayKey, slots]: [string, any]) => {
          const [dayLabel, dayName, dateFormatted] = dayKey.split('|');
          return (
            <tr key={dayKey} className="border-b hover:bg-muted/50">
              <td className="border border-border p-2 font-bold text-center min-w-[120px]">
                <div className="text-sm">{dayLabel.toUpperCase()}</div>
                <div className="text-xs font-semibold">{dayName}</div>
                <div className="text-xs text-muted-foreground">{dateFormatted}</div>
              </td>
              {renderSlotCell(slots.morning, 'morning', slots.date, readonly)}
              {renderSlotCell(slots.afternoon, 'afternoon', slots.date, readonly)}
              {renderSlotCell(slots.evening, 'evening', slots.date, readonly)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const groupHistoryData = (data: any[]) => {
    return data.reduce((acc: any, e: any) => {
      const dateObj = new Date(e.exam_date);
      const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
      const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const key = `${e.day_label}|${dayName}|${dateFormatted}`;
      if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
      acc[key][e.time_slot]?.push(e);
      return acc;
    }, {});
  };

  const filteredHistory = history.filter(h => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return h.semester?.toLowerCase().includes(q) || h.session?.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-1 border-b border-border pb-4">
          <h1 className="text-lg font-bold uppercase tracking-tight">{settings?.school_name || 'University'}</h1>
          <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
          <p className="text-sm font-bold uppercase">Examination Timetable</p>
          <p className="text-xs text-muted-foreground uppercase">{semesterLabel}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={saveTimetableHistory} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Save to History
          </Button>
          <Button variant="outline" onClick={() => downloadPDF(timetableRef, `Exam-Timetable-${activeSemester?.name || 'current'}.pdf`)} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsCreating(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Entry
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader><CardTitle>{editingId ? 'Edit Entry' : 'Add Exam Entry'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Day Label</Label>
                  <Input placeholder="e.g. Day 1" value={form.day_label} onChange={e => setForm(p => ({ ...p, day_label: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.exam_date} onChange={e => {
                    const val = e.target.value;
                    if (new Date(val).getDay() === 5 && form.time_slot === 'afternoon') {
                      toast({ title: 'Note', description: 'Friday afternoon is reserved for Friday Prayer.' });
                      setForm(p => ({ ...p, exam_date: val, time_slot: 'morning', start_time: '08:00', end_time: '11:00' }));
                    } else {
                      setForm(p => ({ ...p, exam_date: val }));
                    }
                  }} />
                </div>
                <div className="space-y-1">
                  <Label>Time Slot</Label>
                  <Select value={form.time_slot} onValueChange={handleTimeSlotChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="z-[9999]">
                      {Object.entries(TIME_SLOTS).map(([k, v]) => (
                        <SelectItem key={k} value={k} disabled={k === 'afternoon' && isFriday(form.exam_date)}>
                          {v.label}{k === 'afternoon' && isFriday(form.exam_date) ? ' (Friday Prayer)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Course selection */}
              <div className="space-y-2">
                <Label className="font-semibold">Course Selection</Label>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <SearchableSelect
                    options={deptOptions}
                    value={filterDept}
                    onValueChange={setFilterDept}
                    placeholder="Filter by Department"
                    searchPlaceholder="Search departments..."
                  />
                  <SearchableSelect
                    options={levelOptions}
                    value={filterLevel}
                    onValueChange={setFilterLevel}
                    placeholder="Filter by Level"
                    searchPlaceholder="Search levels..."
                  />
                  <SearchableSelect
                    options={courseOptions.filter(o => !form.course_codes.includes(o.value))}
                    value=""
                    onValueChange={addCourseCode}
                    placeholder="+ Add Course"
                    searchPlaceholder="Search by code or name..."
                  />
                </div>

                {/* Selected courses */}
                {form.course_codes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.course_codes.map(code => (
                      <Badge key={code} variant="secondary" className="text-sm gap-1 pr-1">
                        {code}
                        <button onClick={() => removeCourseCode(code)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {form.course_codes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Select at least one course from the dropdown above.</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Venue</Label>
                <Input placeholder="e.g. TETFD E, F, G, H" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveEntry} disabled={form.course_codes.length === 0}>{editingId ? 'Update' : 'Add'}</Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Timetable */}
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam timetable entries yet.</p></CardContent></Card>
        ) : (
          <div ref={timetableRef} className="overflow-x-auto bg-background p-4">
            <div className="text-center space-y-1 mb-4">
              <p className="text-lg font-bold uppercase">{settings?.school_name || 'University'}</p>
              <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
              <p className="text-sm font-bold uppercase">Examination Timetable</p>
              <p className="text-xs text-muted-foreground uppercase">{semesterLabel}</p>
            </div>
            {renderTimetableTable(grouped)}
          </div>
        )}

        {/* Timetable History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Timetable History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search by semester or session..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="max-w-sm"
            />
            {filteredHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archived timetables yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <p className="font-semibold">{h.semester}</p>
                      <p className="text-xs text-muted-foreground">Created: {new Date(h.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setPreviewData(h); setPreviewOpen(true); }}>
                      <Eye className="h-4 w-4 mr-1" /> Preview
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Timetable Preview – {previewData?.semester}</DialogTitle>
            </DialogHeader>
            {previewData && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => downloadPDF(previewRef, `Timetable-${previewData.semester}.pdf`)}>
                    <Download className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                </div>
                <div ref={previewRef} className="bg-background p-4">
                  <div className="text-center space-y-1 mb-4">
                    <p className="text-lg font-bold uppercase">{settings?.school_name || 'University'}</p>
                    <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
                    <p className="text-sm font-bold uppercase">Examination Timetable</p>
                    <p className="text-xs text-muted-foreground uppercase">{previewData.semester}</p>
                  </div>
                  <div className="overflow-x-auto">
                    {renderTimetableTable(groupHistoryData(previewData.timetable_data || []), true)}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

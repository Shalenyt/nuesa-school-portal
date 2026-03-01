import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function TeacherExamTimetable() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSemester, setActiveSemester] = useState<any>(null);
  const timetableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (profile) fetchData(); }, [profile]);

  const fetchData = async () => {
    const [{ data: timetable }, { data: courses }, semRes] = await Promise.all([
      (supabase as any).from('exam_timetables').select('*').order('exam_date').order('time_slot'),
      supabase.from('courses').select('id, name, subjects(code)').eq('teacher_id', profile?.id),
      supabase.from('semester_config').select('*').eq('is_active', true).maybeSingle(),
    ]);
    setEntries(timetable || []);
    setActiveSemester(semRes.data);
    const codes = (courses || []).map((c: any) => c.subjects?.code?.toUpperCase()).filter(Boolean);
    setMyCourses(codes);
    setLoading(false);
  };

  const isMyExam = (code: string) => myCourses.some(c => code.toUpperCase().includes(c));
  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  const semesterLabel = activeSemester ? `${activeSemester.name} Academic Session` : 'Academic Session';

  const downloadPDF = async () => {
    if (!timetableRef.current) return;
    const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Exam-Timetable-${activeSemester?.name || 'current'}.pdf`);
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

  const renderSlotCell = (items: any[], slotType: string, dateStr: string) => {
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
              <div key={e.id}>
                <span className={`font-bold text-sm ${isMyExam(e.course_code) ? 'text-red-600 dark:text-red-400' : ''}`}>{e.course_code}</span>
              </div>
            ))}
          </div>
        </td>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (<div key={e.id} className="text-sm text-muted-foreground">{e.venue || '—'}</div>))}
          </div>
        </td>
      </>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="text-center space-y-1 border-b border-border pb-4">
          <h1 className="text-lg font-bold uppercase tracking-tight">{settings?.school_name || 'University'}</h1>
          <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
          <p className="text-sm font-bold uppercase">Examination Timetable</p>
          <p className="text-xs text-muted-foreground uppercase">{semesterLabel}</p>
        </div>

        {loading ? <p className="text-center text-muted-foreground">Loading...</p> : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam timetable available.</p></CardContent></Card>
        ) : (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
            </div>
            <div ref={timetableRef} className="overflow-x-auto bg-background p-4">
              <div className="text-center space-y-1 mb-4">
                <p className="text-lg font-bold uppercase">{settings?.school_name || 'University'}</p>
                <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
                <p className="text-sm font-bold uppercase">Examination Timetable</p>
                <p className="text-xs text-muted-foreground uppercase">{semesterLabel}</p>
              </div>
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
                  {Object.entries(grouped).map(([dayKey, slots]: [string, any]) => {
                    const [dayLabel, dayName, dateFormatted] = dayKey.split('|');
                    const dayIsToday = isToday(slots.date);
                    return (
                      <tr key={dayKey} className={`border-b ${dayIsToday ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/50'}`}>
                        <td className="border border-border p-2 font-bold text-center min-w-[120px]">
                          <div className="text-sm">{dayLabel.toUpperCase()}</div>
                          <div className="text-xs font-semibold">{dayName}</div>
                          <div className="text-xs text-muted-foreground">{dateFormatted}</div>
                          {dayIsToday && <Badge variant="destructive" className="mt-1 text-[10px]">TODAY</Badge>}
                        </td>
                        {renderSlotCell(slots.morning, 'morning', slots.date)}
                        {renderSlotCell(slots.afternoon, 'afternoon', slots.date)}
                        {renderSlotCell(slots.evening, 'evening', slots.date)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2 text-center">Courses in <span className="text-red-600 font-semibold">red</span> are your assigned courses.</p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

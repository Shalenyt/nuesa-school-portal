import { useSchoolSettings } from '@/hooks/useSchoolSettings';

/**
 * Heading for the exam timetable (admin, student and lecturer pages, and the
 * PDF). School logo from Admin Profile on the left, title in Times New Roman.
 */
export function ExamTimetableHeading({ sessionLabel }: { sessionLabel: string }) {
  const { settings } = useSchoolSettings();
  return (
    <div
      className="mb-4 grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_7.5rem]"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="flex items-center justify-start">
        {settings?.logo_url && (
          <img
            src={settings.logo_url}
            alt="School logo"
            crossOrigin="anonymous"
            className="h-[4.5rem] w-[4.5rem] object-contain sm:h-28 sm:w-28"
          />
        )}
      </div>
      <div className="space-y-0.5 text-center">
        <p className="text-base font-bold uppercase leading-tight sm:text-lg">{settings?.school_name || 'University'}</p>
        <p className="text-sm font-bold uppercase leading-tight sm:text-base">Faculty of Engineering</p>
        <p className="text-sm font-bold uppercase leading-tight sm:text-base">Examination Timetable</p>
        <p className="text-xs uppercase text-muted-foreground sm:text-sm">{sessionLabel}</p>
      </div>
      {/* Empty column keeps the title centred */}
      <div aria-hidden="true" />
    </div>
  );
}

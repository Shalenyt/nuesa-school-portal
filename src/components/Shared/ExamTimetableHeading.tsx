import { useSchoolSettings } from '@/hooks/useSchoolSettings';

/**
 * Heading for the exam timetable (admin, student and lecturer pages, and the
 * PDF). School logo from Admin Profile on the left, title in Times New Roman.
 */
export function ExamTimetableHeading({ sessionLabel }: { sessionLabel: string }) {
  const { settings } = useSchoolSettings();
  return (
    <div
      className="mb-4 grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_5.5rem]"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="flex items-center justify-start">
        {settings?.logo_url && (
          <img
            src={settings.logo_url}
            alt="School logo"
            crossOrigin="anonymous"
            className="h-14 w-14 object-contain sm:h-20 sm:w-20"
          />
        )}
      </div>
      <div className="space-y-1 text-center">
        <p className="text-lg font-bold uppercase leading-tight sm:text-2xl">{settings?.school_name || 'University'}</p>
        <p className="text-base font-bold uppercase leading-tight sm:text-xl">Faculty of Engineering</p>
        <p className="text-base font-bold uppercase leading-tight sm:text-xl">Examination Timetable</p>
        <p className="text-xs uppercase text-muted-foreground sm:text-sm">{sessionLabel}</p>
      </div>
      {/* Empty column keeps the title centred */}
      <div aria-hidden="true" />
    </div>
  );
}

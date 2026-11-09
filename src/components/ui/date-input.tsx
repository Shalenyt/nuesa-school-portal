import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/*
 * Date pickers that always read day/month/year (09/11/2026), whatever the
 * phone's region. The browser's own date box follows the device setting and
 * shows month first on many phones. Values stay in the same form as before:
 * "2026-11-09" for dates and "2026-11-09T14:30" for date and time.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromValue = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};
export const formatDMY = (v?: string | null) => {
  const d = fromValue(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
};

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function DateInput({ value, onChange, min, max, id, placeholder = 'dd/mm/yyyy', className, disabled, ...rest }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = fromValue(value);
  const from = fromValue(min);
  const to = fromValue(max);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={rest['aria-label']}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span>{value ? formatDMY(value) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected || from}
          onSelect={(d) => {
            if (d) onChange(toValue(d));
            setOpen(false);
          }}
          fromDate={from}
          toDate={to}
          weekStartsOn={1}
          initialFocus
        />
        {value && (
          <div className="border-t p-2 text-right">
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { onChange(''); setOpen(false); }}>
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Date (day/month/year) plus a time box, for "2026-11-09T14:30" values */
export function DateTimeInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [date, time] = (value || '').split('T');
  return (
    <div className={cn('grid grid-cols-[1fr_auto] gap-2', className)}>
      <DateInput value={date || ''} onChange={(d) => onChange(d ? `${d}T${time || '23:59'}` : '')} aria-label="Date" />
      <Input
        type="time"
        value={(time || '').slice(0, 5)}
        onChange={(e) => onChange(`${date || toValue(new Date())}T${e.target.value}`)}
        aria-label="Time"
        className="w-32"
      />
    </div>
  );
}

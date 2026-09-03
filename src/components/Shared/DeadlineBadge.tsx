import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDeadlineStatus, URGENCY_LEGEND, type DeadlineStatus } from '@/lib/deadline';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DeadlineBadgeProps {
  dueDate: string | Date | null | undefined;
  className?: string;
  /** Show the category ("Due soon") alongside the countdown */
  showCategory?: boolean;
}

/**
 * Small, non-intrusive urgency badge.
 * Always pairs colour with text so it stays readable without colour vision.
 */
export function DeadlineBadge({ dueDate, className, showCategory = false }: DeadlineBadgeProps) {
  const status: DeadlineStatus | null = getDeadlineStatus(dueDate);
  if (!status) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        status.badgeClass,
        className,
      )}
      title={`${status.category} — ${status.label}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClass)} aria-hidden="true" />
      <span>{showCategory ? `${status.category} · ${status.label}` : status.label}</span>
    </span>
  );
}

/**
 * Compact legend. Full inline row on desktop, a small info button on mobile.
 */
export function DeadlineLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      {/* Desktop / tablet */}
      <div className="hidden md:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Deadline status</span>
        {URGENCY_LEGEND.map((item) => (
          <span key={item.level} className="inline-flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', item.dotClass)} aria-hidden="true" />
            {item.short}
          </span>
        ))}
      </div>

      {/* Mobile */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="What do the deadline colours mean?"
            className="md:hidden inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Deadline status
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-3">
          <p className="mb-2 text-xs font-medium">Deadline status</p>
          <ul className="space-y-1.5">
            {URGENCY_LEGEND.map((item) => (
              <li key={item.level} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', item.dotClass)} aria-hidden="true" />
                <span className="text-foreground">{item.short}</span>
                <span className="ml-auto">{item.description}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Nigerian date format everywhere (e.g. 31/12/2026 instead of 12/31/2026).
 *
 * Pages call date.toLocaleDateString() / toLocaleString() / toLocaleTimeString()
 * without a locale, which makes the browser pick its own (usually American,
 * month first). This makes those calls default to Nigerian English, falling
 * back to British English (same day-first order) where the browser lacks it.
 * Calls that pass their own locale are left alone. Only dates are affected;
 * number and currency formatting (₦5,000) is unchanged.
 */
const NIGERIAN_LOCALES = ['en-NG', 'en-GB'];

type DateLocaleMethod = 'toLocaleDateString' | 'toLocaleString' | 'toLocaleTimeString';

function withNigerianDefault(method: DateLocaleMethod) {
  const original = Date.prototype[method];
  Object.defineProperty(Date.prototype, method, {
    configurable: true,
    writable: true,
    value: function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      return original.call(this, locales ?? NIGERIAN_LOCALES, options);
    },
  });
}

let applied = false;
export function applyNigerianDateFormat() {
  if (applied) return;
  applied = true;
  withNigerianDefault('toLocaleDateString');
  withNigerianDefault('toLocaleString');
  withNigerianDefault('toLocaleTimeString');
}

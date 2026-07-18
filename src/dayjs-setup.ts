/**
 * Single global dayjs instance with the plugins every date module needs. Imported by entry.ts
 * (browser) and preloaded by bun tests (bunfig.toml) so `window.dayjs` resolves in both — date
 * modules read `window.dayjs`, never `import dayjs` (PRD §3.5).
 */
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

// In the browser `window` is the global; bun's test runtime has no `window`, so alias it to
// globalThis before assigning (no-op in the browser, where window already exists).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window ??= globalThis;
window.dayjs = dayjs;

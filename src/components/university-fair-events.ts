/**
 * Public Google Sheet → Alpine rows for the University Fair Events Webflow component.
 * Fetching, CSV parsing, state, and display helpers intentionally live in this one file.
 */
import type { AlpineComponent } from '$types/alpine';

export type SheetRow = Record<string, string>;

type Status = 'loading' | 'error' | 'empty' | 'ready';
type Registration = {
  kind: 'url' | 'email' | 'none';
  href: string;
  label: string;
};

interface UniversityFairEventsState {
  columns: string[];
  rows: SheetRow[];
  status: Status;
  init(): Promise<void>;
  dateParts(value: string): ReturnType<typeof dateParts>;
  isUpcoming(value: string): boolean;
  upcomingRows(dateColumn: string, requiredColumn?: string): SheetRow[];
  registration(value: string): Registration;
  websiteUrl(value: string): string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && next === '\n') index += 1;
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseSheetCsv(csv: string): { columns: string[]; rows: SheetRow[] } {
  const parsed = parseCsvRows(csv);
  if (!parsed.length) return { columns: [], rows: [] };

  const columns = parsed[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '') : header
  );

  if (columns.some((header) => !header.trim())) {
    throw new Error('CSV headers must not be blank');
  }
  if (new Set(columns).size !== columns.length) {
    throw new Error('CSV headers must be unique');
  }

  const rows = parsed
    .slice(1)
    .filter((values) => values.some((value) => value.trim()))
    .map(
      (values) =>
        Object.fromEntries(
          columns.map((column, index) => [column, values[index] ?? ''])
        ) as SheetRow
    );

  return { columns, rows };
}

function calendarDate(value: string): Date | null {
  const input = value.trim();
  const us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  let year: number;
  let month: number;
  let day: number;

  if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
    if (year < 100) year += 2000;
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    // ponytail: the published feed currently uses M/D/Y; add formats only when the sheet changes.
    return null;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function dateParts(
  value: string
): { weekday: string; day: string; monthYear: string } | null {
  const date = calendarDate(value);
  if (!date) return null;

  return {
    weekday: WEEKDAYS[date.getDay()],
    day: String(date.getDate()),
    monthYear: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

export function isUpcoming(value: string, today = new Date()): boolean {
  const date = calendarDate(value);
  if (!date) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() >= todayStart.getTime();
}

export function getUpcomingRows(
  rows: SheetRow[],
  dateColumn: string,
  requiredColumn?: string,
  today = new Date()
): SheetRow[] {
  return rows
    .filter(
      (row) =>
        isUpcoming(row[dateColumn] ?? '', today) &&
        (!requiredColumn || Boolean(row[requiredColumn]?.trim()))
    )
    .sort(
      (first, second) =>
        (calendarDate(first[dateColumn] ?? '')?.getTime() ?? 0) -
        (calendarDate(second[dateColumn] ?? '')?.getTime() ?? 0)
    );
}

function httpUrl(value: string, addProtocol: boolean): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const candidate =
    addProtocol && !/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function registration(value: string): Registration {
  const input = value.trim();
  const urlMatch = input.match(/https?:\/\/[^\s]+/i);
  const href = urlMatch ? httpUrl(urlMatch[0], false) : '';
  if (href) return { kind: 'url', href, label: 'Register' };

  const emailMatch = input.match(/[a-z\d._-]+@[a-z\d._-]+\.[a-z\d._-]+/i);
  if (emailMatch) return { kind: 'email', href: `mailto:${emailMatch[0]}`, label: 'Email' };

  return { kind: 'none', href: '', label: '' };
}

export function websiteUrl(value: string): string {
  return httpUrl(value, true);
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('alpine:init', () => {
    window.Alpine.data('universityFairEvents', function () {
      return {
        columns: [],
        rows: [],
        status: 'loading',

        async init() {
          try {
            const sheetUrl = this.$root.dataset.sheetUrl?.trim();
            if (!sheetUrl) throw new Error('Missing data-sheet-url');

            const url = new URL(sheetUrl);
            if (url.protocol !== 'https:') throw new Error('data-sheet-url must use HTTPS');

            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Sheet request failed: ${response.status} ${response.statusText}`);
            }

            const result = parseSheetCsv(await response.text());
            this.columns = result.columns;
            this.rows = result.rows;
            this.status = result.rows.length ? 'ready' : 'empty';
          } catch (error) {
            console.error('universityFairEvents: failed to load sheet', error);
            this.columns = [];
            this.rows = [];
            this.status = 'error';
          }
        },

        dateParts(value) {
          return dateParts(value);
        },

        isUpcoming(value) {
          return isUpcoming(value);
        },

        upcomingRows(dateColumn, requiredColumn) {
          return getUpcomingRows(this.rows, dateColumn, requiredColumn);
        },

        registration(value) {
          return registration(value);
        },

        websiteUrl(value) {
          return websiteUrl(value);
        },
      } as AlpineComponent<UniversityFairEventsState>;
    });
  });
}

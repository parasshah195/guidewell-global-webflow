import { expect, test } from 'bun:test';

import {
  dateParts,
  getUpcomingRows,
  isUpcoming,
  parseSheetCsv,
  registration,
  websiteUrl,
} from '../components/university-fair-events';

test('parseSheetCsv exposes dynamic headers and handles real CSV quoting/row shapes', () => {
  const result = parseSheetCsv(
    '\uFEFFSchool,Info,Audience\r\n' +
      '"University, A","Line 1\nLine ""2""",Students\r\n' +
      'University B\r\n' +
      ',,\r\n' +
      'University C,Info,Parents,ignored'
  );

  expect(result.columns).toEqual(['School', 'Info', 'Audience']);
  expect(result.rows).toEqual([
    { School: 'University, A', Info: 'Line 1\nLine "2"', Audience: 'Students' },
    { School: 'University B', Info: '', Audience: '' },
    { School: 'University C', Info: 'Info', Audience: 'Parents' },
  ]);
  expect(() => parseSheetCsv('School,School\nA,B')).toThrow('CSV headers must be unique');
  expect(() => parseSheetCsv('School, \nA,B')).toThrow('CSV headers must not be blank');
  expect(() => parseSheetCsv('School\n"open')).toThrow('unterminated quoted field');
});

test('date helpers preserve local calendar dates and sort upcoming required rows', () => {
  const today = new Date(2026, 6, 25);
  const rows = [
    { School: 'Later', Date: '8/2/2026' },
    { School: 'Past', Date: '7/24/2026' },
    { School: 'Sooner', Date: '07/25/26' },
    { School: '', Date: '8/1/2026' },
    { School: 'Invalid', Date: '31/12/2026' },
  ];

  expect(dateParts('8/1/2026')).toEqual({
    weekday: 'Sat',
    day: '1',
    monthYear: 'Aug 2026',
  });
  expect(dateParts('2026-08-01')).toEqual(dateParts('8/1/2026'));
  expect(isUpcoming('7/25/2026', today)).toBe(true);
  expect(isUpcoming('7/24/2026', today)).toBe(false);
  expect(getUpcomingRows(rows, 'Date', 'School', today).map((row) => row.School)).toEqual([
    'Sooner',
    'Later',
  ]);
});

test('link helpers preserve the live URL/email behavior and reject unsafe protocols', () => {
  expect(registration('Register at https://example.com/fair')).toEqual({
    kind: 'url',
    href: 'https://example.com/fair',
    label: 'Register',
  });
  expect(registration('Email fairs@example.org for a place')).toEqual({
    kind: 'email',
    href: 'mailto:fairs@example.org',
    label: 'Email',
  });
  expect(registration('Registration coming soon')).toEqual({
    kind: 'none',
    href: '',
    label: '',
  });
  expect(websiteUrl('example.com')).toBe('https://example.com/');
  expect(websiteUrl('javascript:alert(1)')).toBe('');
});

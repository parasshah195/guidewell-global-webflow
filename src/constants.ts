// Confirmed by Ashley Rose (2026-07-16): GWG's OneCanoe events live at /api/gwg/public/v2/events.
export const API_BASE = 'https://guidewelleducation.onecanoe.com/api/gwg/public/v2';

export const DEFAULT_EVENT_LIMIT = 12;
export const DEFAULT_TIMEZONE = 'Europe/London';

// Confirmed (2026-07-16): API `price` is always ex-VAT; UK VAT is a flat 20% (PRD §10).
export const VAT_MULTIPLIER = 1.2;

// Confirmed by Luke Anthony (2026-07-09/11): the API has no `proctored` field or filter param —
// proctored-ness is conveyed by this tag on the event; absence of the tag means non-proctored.
export const PROCTORED_TAG = 'Proctored';

export const TEST_TOPIC_IDS: Record<string, number[]> = {
  SAT: [1134],
  ACT: [1049],
  PSAT: [1133],
  SHSAT: [1132],
  EACT: [1199],
  'EF Coaching': [1187],
  // AP — all subjects grouped; also keyed individually for granular CMS options
  AP: [1013, 1014, 1015, 1016, 1022, 1023, 1025, 1030, 1031, 1042, 1044, 1045, 2022, 2023],
  'AP Biology': [1013],
  'AP Calculus AB': [1014],
  'AP Calculus BC': [1015],
  'AP Chemistry': [1016],
  'AP English Language': [1022],
  'AP English Literature': [1023],
  'AP European History': [1025],
  'AP U.S. Government and Politics': [1030, 2023],
  'AP Human Geography': [1031],
  'AP Statistics': [1042],
  'AP U.S. History': [1044, 2022],
  'AP World History': [1045],
  // SSAT — grouped and by level
  SSAT: [1001, 1090, 1200],
  'SSAT Elementary Level': [1200],
  'SSAT Middle Level': [1001],
  'SSAT Upper Level': [1090],
  // ISEE — grouped and by level
  ISEE: [1094, 1095, 1096],
  'ISEE Lower Level': [1094],
  'ISEE Middle Level': [1095],
  'ISEE Upper Level': [1096],
};

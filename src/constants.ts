// Confirmed by Ashley Rose (2026-07-16): GWG's OneCanoe events live at /api/gwg/public/v2/events.
export const API_BASE = 'https://guidewelleducation.onecanoe.com/api/gwg/public/v2';

export const DEFAULT_EVENT_LIMIT = 12;
export const DEFAULT_TIMEZONE = 'Europe/London';

// Confirmed by Luke Anthony (2026-07-09/11): the API has no `proctored` field or filter param —
// proctored-ness is conveyed by this tag on the event; absence of the tag means non-proctored.
export const PROCTORED_TAG = 'Proctored';

// ponytail: empty until GWG provides per-test topic IDs (PRD §10)
export const TEST_TOPIC_IDS: Record<string, number[]> = {
  SAT: [],
  ACT: [],
  AP: [],
  PSAT: [],
};

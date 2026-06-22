// ponytail: placeholder slug, confirm with GWG/OneCanoe before go-live (PRD §10)
export const API_BASE = 'https://guidewelleducation.onecanoe.com/api/v1';

export const DEFAULT_EVENT_LIMIT = 12;
export const DEFAULT_TIMEZONE = 'Europe/London';

// ponytail: empty until GWG provides per-test topic IDs (PRD §10)
export const TEST_TOPIC_IDS: Record<string, number[]> = {
  SAT: [],
  ACT: [],
  AP: [],
  PSAT: [],
};

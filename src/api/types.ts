/**
 * Port of Summit's `eventQueryTypes.ts` for the same OneCanoe Events API (PRD §2, §8)
 */
export type APIResponseData = {
  data: APIResponse[];
};

export type QueryParamsCategories = 'practice_test' | 'marketing_event' | 'class' | 'all';

// Confirmed against the live GWG API (2026-07-16): the `category` filter takes 'practice_test',
// but the response `type` field comes back as 'practice_test_event' — different vocabularies.
export type EventType = 'practice_test_event' | 'marketing_event' | 'class';

export type DaysOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type QueryParams = {
  category?: Array<QueryParamsCategories>;
  market?: number;
  id?: number;
  name?: string;
  event_code?: string | string[];
  tags?: Array<string>;
  limit?: number;
  start?: number;
  topics?: Array<number | string>;
  before?: Date | string;
  after?: Date | string;
  timezone?: string;
  test_date?: Date;
  is_online?: boolean;
  extended_time_available?: boolean;
  days_of_week?: Array<string>;
  location_id?: number;
};

export const QueryParamsProperties: (keyof QueryParams)[] = [
  'category',
  'market',
  'id',
  'name',
  'event_code',
  'tags',
  'limit',
  'start',
  'topics',
  'before',
  'after',
  'timezone',
  'test_date',
  'is_online',
  'extended_time_available',
  'days_of_week',
  'location_id',
];

export interface APIResponse {
  id: number;
  name: string;
  type: EventType;
  description: string;
  event_code: string;
  is_online: boolean;
  test_date?: Date | null;
  starts_at: string | null;
  ends_at: string | null;
  price: string;
  class_schedule?: null | {
    first_session: { starts_at: string; ends_at: string };
    final_session: { starts_at: string; ends_at: string };
    first_practice_test: { starts_at: string; ends_at: string };
    final_practice_test: { starts_at: string; ends_at: string };
    instructional_time: number;
    sessions_count: number;
  };
  tags: Array<string>;
  markets: Array<number>;
  topics: Array<string>;
  days_of_week: Array<DaysOfWeek>;
  address: string | null;
  presenters: Array<string> | null;
  location_id: number | null;
  location_name: string | null;
  google_maps_url: string;
  extended_time_available: boolean | null;
  event_page_url: string;
}

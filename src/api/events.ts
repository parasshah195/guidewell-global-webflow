import { API_BASE, DEFAULT_EVENT_LIMIT } from '$constants';
import { applyVAT } from '$utils/event-format';
import type { APIResponse, APIResponseData, QueryParams } from './types';

/**
 * Single fetch function for the OneCanoe Events API — no class hierarchy (PRD §3.3).
 */
export async function fetchEvents(params: QueryParams): Promise<APIResponse[] | null> {
  const body: QueryParams = { start: 0, limit: DEFAULT_EVENT_LIMIT, ...params };

  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`fetchEvents: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = (await res.json()) as APIResponseData;
    return (json.data ?? []).map((event) => ({ ...event, price: applyVAT(event.price) }));
  } catch (err) {
    console.error('fetchEvents: network error', err);
    return null;
  }
}

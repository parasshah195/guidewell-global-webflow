/**
 * "Find by event code" component (PRD §4 Phase 2, CSV #5) — redirects to the matching event's
 * page. Registers on `alpine:init` using the global `window.Alpine` — never imports Alpine
 * (PRD §3.4). Bind an input to `eventCode`, a submit to `search()`, and show/hide an error
 * message with `x-show="isError"`.
 */
import { fetchEvents } from '$api/events';
import type { AlpineComponent } from '$types/alpine';

interface EventCodeSearchState {
  eventCode: string;
  isLoading: boolean;
  isError: boolean;
  search(): Promise<void>;
}

window.addEventListener('alpine:init', () => {
  window.Alpine.data('eventCodeSearch', function () {
    return {
      eventCode: '',
      isLoading: false,
      isError: false,

      async search() {
        this.isLoading = true;
        this.isError = false;

        const results = await fetchEvents({ category: ['all'], event_code: this.eventCode });

        this.isLoading = false;

        if (!results?.length) {
          this.isError = true;
          return;
        }

        window.location.href = results[0].event_page_url;
      },
    } as AlpineComponent<EventCodeSearchState>;
  });
});

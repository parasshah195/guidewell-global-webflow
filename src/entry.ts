import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import '$dev/debug';
import '$dev/env';
import { LOCAL_SERVER } from '$dev/env';

// Single global dayjs instance — date modules use `window.dayjs`, never `import dayjs` (PRD §3.5)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
window.dayjs = dayjs;

/**
 * Entry point for the build system.
 * Fetches scripts from localhost or production site depending on the setup
 * Polls `localhost` on page load, else falls back to deriving code from production URL
 */

// Add ScriptOptions and ScriptListItem types for global use
interface ScriptOptions {
  placement: 'head' | 'body';
  defer: boolean;
  isModule: boolean;
  scriptName?: string;
}

window.PRODUCTION_BASE = 'https://cdn.jsdelivr.net/gh/parasshah195/guidewell-global-webflow/dist/prod/';
const relativePathBase = window.SCRIPTS_ENV === 'local' ? LOCAL_SERVER : window.PRODUCTION_BASE;

/**
 * Loads a script either from the JS repo, or accepts a direct library URL too
 * Examples:
 * ```ts
 * window.loadScript('global.js');
 * window.loadScript('https://cdn.jsdelivr.net/npm/some-lib@1.0.0/dist/index.js', {
 *   placement: 'head',
 *   scriptName: 'some-lib',
 * });
 * ```
 * @param url - The URL of the script to load
 * @param options - The options for the script
 * @returns A promise that resolves when the script is loaded
 */
window.loadScript = function (url, options): Promise<void> {
  const opts: ScriptOptions = { placement: 'body', isModule: true, defer: true, ...options };

  // Work with both relative repo paths and direct CDN URLs
  const isAbsolute = url.startsWith('https://');
  const finalUrl = isAbsolute ? url : relativePathBase + url;

  if (document.querySelector(`script[src="${finalUrl}"]`)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = finalUrl;
    if (opts.isModule) script.type = 'module';
    if (opts.defer) script.defer = true;
    script.onload = () => {
      if (opts.scriptName) {
        document.dispatchEvent(
          new CustomEvent(`scriptLoaded:${opts.scriptName}`, {
            detail: { url: finalUrl, scriptName: opts.scriptName },
          })
        );
      }
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${finalUrl}`));

    document[opts.placement].appendChild(script);
  });
};

/**
 * Loads each component bundle, then `alpine.js` last so every `alpine:init` listener is
 * registered before `Alpine.start()` fires (PRD §9).
 */
window.startAlpine = (components: string[]): Promise<void> =>
  Promise.all(components.map((name) => window.loadScript(`components/${name}.js`))).then(() =>
    window.loadScript('alpine.js')
  );

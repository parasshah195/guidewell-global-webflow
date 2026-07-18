import { type QueryParams, QueryParamsProperties } from '$api/types';

const ATTR_PREFIX = 'query-';

/**
 * Reads `query-*` attributes off `el` and writes type-coerced values into `component.baseParams`.
 */
export function setEventQueryFromAttr(
  el: HTMLElement,
  component: { baseParams: QueryParams }
): void {
  for (const attr of el.attributes) {
    if (!attr.name.startsWith(ATTR_PREFIX)) continue;

    const key = attr.name.substring(ATTR_PREFIX.length) as keyof QueryParams;
    if (QueryParamsProperties.includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component.baseParams as any)[key] = parseAttrValue(attr.value);
    }
  }
}

/**
 * ponytail: coercion is by string *shape*, not by target key — an all-digit `event_code` would
 * coerce to a number, and `Date.parse` is loose. Acceptable for current attrs (PRD §6); upgrade to
 * per-key typed coercion (keyed off `QueryParamsProperties`) only if a real value ever collides.
 */
export function parseAttrValue(
  value: string
): number | boolean | string | Array<string | number> | Date {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (!isNaN(Date.parse(value))) {
    return new Date(value);
  }

  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;

  return arrayCheck(value);
}

export function arrayCheck(value: string): string | Array<string | number> {
  try {
    const parsed = JSON.parse(value.replace(/'([^']*)'/g, '"$1"'));
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

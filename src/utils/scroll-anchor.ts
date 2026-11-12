const ANCHOR = '[data-filter-anchor]';

/** Remember the first marked section in view; the returned fn scrolls it back to the same spot. */
export function holdAnchor(): () => void {
  const el = [...document.querySelectorAll<HTMLElement>(ANCHOR)].find((e) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  if (!el) return () => {};
  const top = el.getBoundingClientRect().top;
  return () => {
    if (!el.isConnected) return;
    const delta = el.getBoundingClientRect().top - top;
    if (delta) window.scrollBy(0, delta);
  };
}

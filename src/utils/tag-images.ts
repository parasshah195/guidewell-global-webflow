/**
 * CMS tag images for webinar cards (PRD §6). Images live in the DOM (Webflow CMS collection),
 * not the Events API. API events only supply `tags` strings to match against.
 */

export type TagImage = { src: string; alt: string };

export const EMPTY_TAG_IMAGE: TagImage = { src: '', alt: '' };

/**
 * Reads imgs under `[data-el="tag-images"]`. Tag key is `data-tag`, falling back to Summit's
 * `tag_name` so migrated CMS items don't need a rebind.
 */
export function collectTagImages(root: ParentNode): Map<string, TagImage[]> {
  const bank = root.querySelector('[data-el="tag-images"]');
  if (!bank) return new Map();

  const byTag = new Map<string, TagImage[]>();

  bank.querySelectorAll('img').forEach((img) => {
    const tag = img.getAttribute('data-tag') || img.getAttribute('tag_name');
    const src = img.getAttribute('src');
    if (!tag || !src) return;

    const list = byTag.get(tag) ?? [];
    list.push({ src, alt: img.getAttribute('alt') || '' });
    byTag.set(tag, list);
  });

  return byTag;
}

/**
 * First event tag that has images in the bank, then one image from that tag.
 * `random` is injectable so tests don't flake.
 */
export function pickTagImage(
  tags: string[],
  bank: Map<string, TagImage[]>,
  random: () => number = Math.random
): TagImage | null {
  for (const tag of tags) {
    const images = bank.get(tag);
    if (!images?.length) continue;
    return images[Math.floor(random() * images.length)] ?? null;
  }
  return null;
}

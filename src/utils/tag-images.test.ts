import { expect, test } from 'bun:test';

import { collectTagImages, pickTagImage } from './tag-images';

function fakeRoot(
  imgs: { tag?: string; tagName?: string; src?: string; alt?: string }[] | null
): ParentNode {
  const elements = (imgs ?? []).map((i) => ({
    getAttribute(name: string) {
      if (name === 'data-tag') return i.tag ?? null;
      if (name === 'tag_name') return i.tagName ?? null;
      if (name === 'src') return i.src ?? null;
      if (name === 'alt') return i.alt ?? null;
      return null;
    },
  }));
  const bank = { querySelectorAll: () => elements };
  return {
    querySelector: (sel: string) => (imgs && sel === '[data-el="tag-images"]' ? bank : null),
  } as unknown as ParentNode;
}

test('collectTagImages indexes data-tag and Summit tag_name imgs', () => {
  const bank = collectTagImages(
    fakeRoot([
      { tag: 'SAT Prep', src: '/sat.jpg', alt: 'SAT' },
      { tagName: 'ACT', src: '/act.jpg', alt: 'ACT' },
      { tag: 'SAT Prep', src: '/sat-2.jpg', alt: '' },
      { src: '/orphan.jpg', alt: 'no tag' },
    ])
  );
  expect([...bank.keys()]).toEqual(['SAT Prep', 'ACT']);
  expect(bank.get('SAT Prep')).toEqual([
    { src: '/sat.jpg', alt: 'SAT' },
    { src: '/sat-2.jpg', alt: '' },
  ]);
  expect(bank.get('ACT')).toEqual([{ src: '/act.jpg', alt: 'ACT' }]);
});

test('collectTagImages returns empty when the bank is missing', () => {
  expect(collectTagImages(fakeRoot(null)).size).toBe(0);
});

test('pickTagImage uses the first tag that has images and the injected random', () => {
  const bank = new Map([
    ['ACT', [{ src: '/act.jpg', alt: 'A' }]],
    [
      'SAT Prep',
      [
        { src: '/a.jpg', alt: '1' },
        { src: '/b.jpg', alt: '2' },
      ],
    ],
  ]);

  expect(pickTagImage(['missing', 'SAT Prep'], bank, () => 0)).toEqual({
    src: '/a.jpg',
    alt: '1',
  });
  expect(pickTagImage(['SAT Prep'], bank, () => 0.99)).toEqual({ src: '/b.jpg', alt: '2' });
  expect(pickTagImage(['none'], bank)).toBe(null);
  expect(pickTagImage([], bank)).toBe(null);
});

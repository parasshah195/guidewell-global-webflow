/**
 * Only file that imports Alpine (PRD §3.4). Sets `window.Alpine`, runs the Webflow↔Alpine DOM
 * bridge (Webflow can't author `<template>` or `.` in attribute names — PRD §2), registers the
 * `filters` store, then starts Alpine. Loaded last by `startAlpine` (PRD §9) so every component's
 * `alpine:init` listener is already registered.
 */
import Alpine from 'alpinejs';

import { registerFiltersStore } from '$stores/filters';

window.Alpine = Alpine;

function getAlpineAttributes(el: HTMLElement): Attr[] {
  return Array.from(el.attributes).filter((a) => a.name.startsWith('x-'));
}

function replaceDotAttributes(el: HTMLElement): void {
  getAlpineAttributes(el).forEach((a) => {
    const m = a.name.match(/^(x-[^:]+)(:.+)$/);
    if (!m) return;

    let newName: string | null = null;
    if (['x-bind', 'x-on'].includes(m[1])) {
      let prefix = m[1];
      let suffix = m[2].substring(1);
      if (prefix === 'x-on' && suffix.startsWith('update:')) {
        prefix += ':update';
        suffix = suffix.substring(7);
      }
      if (suffix.includes(':')) {
        newName = `${prefix}:${suffix.replace(/:/g, '.')}`;
      }
    } else {
      newName = m[1] + m[2].replace(/:/g, '.');
    }

    if (newName) {
      el.setAttribute(newName, a.value);
      el.removeAttribute(a.name);
    }
  });
}

function wrapInTemplate(el: HTMLElement): void {
  const template = document.createElement('template');
  getAlpineAttributes(el).forEach((a) => {
    template.setAttribute(a.name, a.value);
    el.removeAttribute(a.name);
  });
  el.parentNode?.insertBefore(template, el);
  template.content.appendChild(el);
}

function clearTransitionValues(el: HTMLElement): void {
  getAlpineAttributes(el).forEach((a) => {
    if (a.name.match(/^x-transition.*(?!(enter|leave))/)) {
      el.setAttribute(a.name, '');
    }
  });
}

function webflowBridge(): void {
  document.querySelectorAll<HTMLElement>('[x-data],[x-data] *').forEach((el) => {
    replaceDotAttributes(el);
    clearTransitionValues(el);
  });

  document
    .querySelectorAll<HTMLElement>('[x-data] [x-for]:not(template), [x-data] [x-if]:not(template)')
    .forEach((el) => wrapInTemplate(el));
}

function boot(): void {
  webflowBridge();
  Alpine.start();
}

window.addEventListener('alpine:init', registerFiltersStore);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

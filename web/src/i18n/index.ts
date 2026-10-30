import { usePrefs } from '../state/prefs';
import vi from './vi';

/**
 * Tiny i18n: English text lives inline at the call site (`t('key', 'English')`),
 * other languages are flat key → string maps. To add a language, copy vi.ts and register it below.
 */
export const LANGUAGES = { en: 'English', vi: 'Tiếng Việt' } as const;
export type Lang = keyof typeof LANGUAGES;
const DICTS: Partial<Record<Lang, Record<string, string>>> = { vi };

export function resolveLang(pref: string): Lang {
  if (pref !== 'auto' && pref in LANGUAGES) return pref as Lang;
  const nav = (navigator.language || 'en').slice(0, 2);
  return (nav in LANGUAGES ? nav : 'en') as Lang;
}

function format(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

export function translate(lang: Lang, key: string, en: string, vars?: Record<string, string | number>) {
  return format(DICTS[lang]?.[key] ?? en, vars);
}

export function useT() {
  const lang = resolveLang(usePrefs(s => s.lang));
  return Object.assign((key: string, en: string, vars?: Record<string, string | number>) => translate(lang, key, en, vars), { lang });
}

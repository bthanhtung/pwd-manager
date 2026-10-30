import { create } from 'zustand';

export interface Prefs {
  theme: 'system' | 'dark' | 'light';
  lang: 'auto' | 'en' | 'vi';
  autoLockMinutes: number;       // 0 = never
  clipboardClearSeconds: number; // 0 = never
  lockOnHide: boolean;
}

const DEFAULTS: Prefs = { theme: 'system', lang: 'auto', autoLockMinutes: 15, clipboardClearSeconds: 30, lockOnHide: false };
const KEY = 'op_prefs';

function load(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

export const usePrefs = create<Prefs & { set(p: Partial<Prefs>): void }>((set, get) => ({
  ...load(),
  set(p) {
    set(p);
    const { set: _s, ...rest } = { ...get(), ...p };
    try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* private mode */ }
  },
}));

export function applyTheme(theme: Prefs['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b0b10' : '#f7f7fa');
}

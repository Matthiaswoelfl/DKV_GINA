export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'finanz-theme';

export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' =>
  pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* Speicher gesperrt: Standard nutzen */
  }
  return 'system';
}

export function savePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignorieren */
  }
}

export function applyTheme(pref: ThemePref): void {
  const dark = resolveTheme(pref, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

import { useEffect, useState } from 'react';
import { applyTheme, readPref, savePref, type ThemePref } from '../lib/theme';

const OPTIONS: Array<[ThemePref, string]> = [
  ['light', 'Hell'],
  ['system', 'System'],
  ['dark', 'Dunkel'],
];

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs dark:border-slate-600" role="group" aria-label="Farbschema">
      {OPTIONS.map(([value, label]) => (
        <button
          key={value}
          aria-pressed={pref === value}
          className={`px-2.5 py-1.5 ${pref === value ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
          onClick={() => {
            savePref(value);
            setPref(value);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

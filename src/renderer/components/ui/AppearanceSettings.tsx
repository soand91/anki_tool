import React, { useEffect, useState } from 'react';
import { applyTheme, ThemeMode } from './theme';

type Props = {
  registerReset?: (fn: () => void | Promise<void>) => void;
};

const DEFAULT_THEME_MODE: ThemeMode = 'system';

export default function AppearanceSettings({ registerReset }: Props) {
  const api = (window as any).api;
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [loading, setLoading] = useState(true);

  // load initial themeMode from prefs
  useEffect(() => {
    (async () => {
      try {
        const stored = await api.settings?.prefs?.get('themeMode');
        const m: ThemeMode = 
          stored === 'light' || stored === 'dark' || stored === 'system'
            ? stored
            : DEFAULT_THEME_MODE;
        setMode(m);
        applyTheme(m);
      } catch {
        applyTheme(DEFAULT_THEME_MODE);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // register 'reset' handler with SettingsModal header
  useEffect(() => {
    if (!registerReset) return;
    registerReset(async () => {
      try {
        await api.settings?.prefs?.set('themeMode', DEFAULT_THEME_MODE);
      } catch {}
      setMode(DEFAULT_THEME_MODE);
      applyTheme(DEFAULT_THEME_MODE);
    });
  }, [registerReset]);

  const handleChange = async (next: ThemeMode) => {
    setMode(next);
    applyTheme(next);
    try {
      await api.settings?.prefs?.set('themeMode', next);
    } catch {}
  };

  const systemIsDark = 
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-300">Theme</div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Choose how the app follows your system appearance.
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300">
          <input
            type="radio"
            name="themeMode"
            value="system"
            checked={mode === 'system'}
            onChange={() => handleChange('system')}
            disabled={loading}
          />
          <span>System (auto)</span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Current system: {systemIsDark ? 'Dark' : 'Light'}
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300">
          <input
            type="radio"
            name="themeMode"
            value="light"
            checked={mode === 'light'}
            onChange={() => handleChange('light')}
            disabled={loading}
          />
          <span>Light</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300">
          <input
            type="radio"
            name="themeMode"
            value="dark"
            checked={mode === 'dark'}
            onChange={() => handleChange('dark')}
            disabled={loading}
          />
          <span>Dark</span>
        </label>
      </div>

      <div className="mt-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-500 dark:border-zinc-950 dark:text-zinc-400">
        Changes apply immediately. In “System” mode, the app follows your OS light/dark
        preference.
      </div>
    </div>
  );
}
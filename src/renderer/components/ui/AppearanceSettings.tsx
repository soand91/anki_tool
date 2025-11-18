import React, { useEffect, useState } from 'react';
import { applyTheme, ThemeMode } from './theme';
import { PANEL_LAYOUT_PRESET_CHANGED_EVENT, THEME_MODE_CHANGED_EVENT } from '../../settingsEvents';

type Props = {
  registerReset?: (fn: () => void | Promise<void>) => void;
};

type PanelLayoutPreset = 'balanced' | 'wideDecks' | 'wideNotes';

const DEFAULT_THEME_MODE: ThemeMode = 'system';
const DEFAULT_LAYOUT_PRESET: PanelLayoutPreset = 'balanced';

function emitLayoutPresetChange(next: PanelLayoutPreset) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PANEL_LAYOUT_PRESET_CHANGED_EVENT, { detail: next })
  );
}

function emitThemeModeChange(next: ThemeMode) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(THEME_MODE_CHANGED_EVENT, { detail: next })
  );
}

export default function AppearanceSettings({ registerReset }: Props) {
  const api = (window as any).api;
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [layoutPreset, setLayoutPreset] = useState<PanelLayoutPreset>(DEFAULT_LAYOUT_PRESET);
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

        const storedLayout = await api.settings?.prefs?.get('panelLayoutPreset');
        const lp: PanelLayoutPreset = 
          storedLayout === 'wideDecks' || storedLayout === 'wideNotes' || storedLayout === 'balanced'
            ? storedLayout
            : DEFAULT_LAYOUT_PRESET;
        setLayoutPreset(lp)
      } catch {
        applyTheme(DEFAULT_THEME_MODE);
        setLayoutPreset(DEFAULT_LAYOUT_PRESET);
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
        await api.settings?.prefs?.set('panelLayoutPreset', DEFAULT_LAYOUT_PRESET);
      } catch {}
      setMode(DEFAULT_THEME_MODE);
      setLayoutPreset(DEFAULT_LAYOUT_PRESET);
      emitThemeModeChange(DEFAULT_THEME_MODE);
      emitLayoutPresetChange(DEFAULT_LAYOUT_PRESET);
      applyTheme(DEFAULT_THEME_MODE);
    });
  }, [registerReset]);

  const handleThemeChange = async (next: ThemeMode) => {
    setMode(next);
    applyTheme(next);
    try {
      await api.settings?.prefs?.set('themeMode', next);
    } catch {}
    emitThemeModeChange(next);
  };

  const handleLayoutChange = async (next: PanelLayoutPreset) => {
    setLayoutPreset(next);
    try {
      await api.settings?.prefs?.set('panelLayoutPreset', next);
    } catch {}
    emitLayoutPresetChange(next);
  };

  const systemIsDark = 
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div className="space-y-3">
      {/* dark/lightmode */}
      <div className='space-y-2'>
        <div className="mb-0 text-sm font-medium text-zinc-800 dark:text-zinc-300">
          Theme
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Choose how the app follows your system appearance.
        </div>
        
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300">
          <input
            type="radio"
            name="themeMode"
            value="system"
            checked={mode === 'system'}
            onChange={() => handleThemeChange('system')}
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
            onChange={() => handleThemeChange('light')}
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
            onChange={() => handleThemeChange('dark')}
            disabled={loading}
          />
          <span>Dark</span>
        </label>

        <div className="border-b border-zinc-200 pb-1 text-[11px] text-zinc-500 dark:border-zinc-950 dark:text-zinc-400">
          Changes apply immediately. In “System” mode, the app follows your OS light/dark
          preference.
        </div>
      </div>
      {/* layout preferences */}
      <div className='space-y-2'>
        <div className='mb-0 text-sm font-medium text-zinc-800 dark:text-zinc-300'>
          Layout
        </div>
        <div className='text-xs text-zinc-500 dark:text-zinc-400'>
          Choose the default panel layout. You can still drag the dividers at any time.
        </div>

        <label className='flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300'>
          <input
            type='radio'
            name='panelLayoutPreset'
            value='balanced'
            checked={layoutPreset === 'balanced'}
            onChange={() => handleLayoutChange('balanced')}
            disabled={loading}
          />
          <span className='flex gap-1'>
            <span>Balanced</span>
            <span className='text-zinc-500 dark:text-zinc-400'>(Default)</span>
          </span>
          <span className='text-[11px] text-zinc-500 dark:text-zinc-400'>
            Left 30%, top-right 60%
          </span>
        </label>
        <label className='flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300'>
          <input
            type='radio'
            name='panelLayoutPreset'
            value='wideDecks'
            checked={layoutPreset === 'wideDecks'}
            onChange={() => handleLayoutChange('wideDecks')}
            disabled={loading}
          />
          <span>Focus on decks</span>
          <span className='text-[11px] text-zinc-500 dark:text-zinc-400'>
            Wider left panel for browsing.
          </span>
        </label>
        <label className='flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-300'>
          <input
            type='radio'
            name='panelLayoutPreset'
            value='wideNotes'
            checked={layoutPreset === 'wideNotes'}
            onChange={() => handleLayoutChange('wideNotes')}
            disabled={loading}
          />
          <span>Focus on notes</span>
          <span className='text-[11px] text-zinc-500 dark:text-zinc-400'>
            Wider editor area for editing.
          </span>
        </label>

      </div>
    </div>
  );
}

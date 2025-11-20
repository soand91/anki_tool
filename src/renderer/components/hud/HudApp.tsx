import React, { useEffect, useState } from 'react';
import { applyTheme, ThemeMode } from '../ui/theme';
import { THEME_MODE_CHANGED_EVENT } from '../../settingsEvents';
import TitleBar from '../ui/TitleBar';

export function HudApp() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  // Load and apply stored theme preference
  useEffect(() => {
    const api = (window as any).api;
    (async () => {
      try {
        const stored = await api.settings?.prefs?.get('themeMode');
        const m: ThemeMode =
          stored === 'light' || stored === 'dark' || stored === 'system'
            ? stored
            : 'system';
        setThemeMode(m);
        applyTheme(m);
      } catch {
        setThemeMode('system');
        applyTheme('system');
      }
    })();
  }, []);

  // Handle in-window theme change broadcasts
  useEffect(() => {
    const handler = (evt: Event) => {
      const next = (evt as CustomEvent<ThemeMode>).detail;
      if (!next) return;
      setThemeMode(next);
      applyTheme(next);
    };
    window.addEventListener(THEME_MODE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(THEME_MODE_CHANGED_EVENT, handler);
  }, []);

  // Keep in sync with system preference when in "system" mode
  useEffect(() => {
    if (themeMode !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [themeMode]);

  return (
    <>
      <div className='relative flex flex-col h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-[#323232]'>
        <div className='hud-titlebar-wrap relative w-full flex-none'>
          <TitleBar />
        </div>
        {/* HUD content*/}
        <div className='px-2 relative flex-1 min-h-0 w-full overflow-hidden text-zinc-600 dark:text-zinc-400'>
          {/* Field wrappers */}
          <div className='group relative text-xs h-full w-full py-1 flex flex-col gap-1'>
            {/* Front */}
            <div className='cursor-pointer flex-1 min-h-0 rounded-xl border border-zinc-200 dark:border-zinc-950 px-1.5 py-1.5'>
              <div className='h-full leading-[1.25] overflow-hidden'>
                <div className='break-words -mt-[0.22em]'>
                  Front Preview
                </div>
              </div>
            </div>
            {/* Back */}
            <div className='cursor-pointer flex-1 min-h-0 rounded-xl border border-zinc-200 dark:border-zinc-950 px-1.5 py-1.5'>
              <div className='h-full leading-[1.25] overflow-hidden'>
                <div className='break-words -mt-[0.22em]'>
                  Back Preview
                </div>
              </div>
            </div>
            <div className='dark:outline-1 dark:outline-zinc-500 pointer-events-none absolute bottom-2 right-1 select-none rounded bg-zinc-700/90 px-2 py-1 text-[10px] text-zinc-200 opacity-0 transition-opacity duration-250 group-hover:opacity-100'>
              Double click to open
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .drag-region {
          -webkit-app-region: drag;
          -webkit-user-select: none;
        }
        .no-drag {
          -webkit-app-region: no-drag;
        }
        .hud-titlebar-wrap::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
          pointer-events: none;
        }
        .dark .hud-titlebar-wrap::after {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </>
  );
}

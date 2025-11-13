import React, { useEffect } from 'react';

type Props = {
  registerReset?: (fn: () => void | Promise<void>) => void;
};

type ThemeMode = 'system' | 'light' | 'dark'

const DEFAULTS = {
  minimizeToTray: true,
  startMinimized: false,
  launchOnStartup: false,
};

export default function GeneralSettings({ registerReset }: Props) {
  const api = (window as any).api;

  const [minToTray, setMinToTray] = React.useState<boolean>(DEFAULTS.minimizeToTray);
  const [startMinimized, setStartMinimized] = React.useState(DEFAULTS.startMinimized);
  const [launchOnStartup, setLaunchOnStartup] = React.useState(DEFAULTS.launchOnStartup);

  const [themeMode, setThemeMode] = React.useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light');

  // load current prefs on mount
  useEffect(() => {
    (async () => {
      try {
        setMinToTray(await api.settings.prefs.get('minimizeToTray'));
        setStartMinimized(await api.settings.prefs.get('startMinimized'));
        setLaunchOnStartup(await api.settings.prefs.get('launchOnStartup'));

        // theme info
        const stored = await api.settings.prefs.get('themeMode');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeMode(stored);
        }

        if (window.matchMedia) {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          setSystemTheme(mq.matches ? 'dark' : 'light');
        }
      } catch {}
    })();
  }, []);

  // Exposed reset function
  useEffect(() => {
    if (!registerReset) return;
    registerReset(async () => {
      try {
        await api.settings.prefs.set('minimizeToTray', DEFAULTS.minimizeToTray);
        await api.settings.prefs.set('startMinimized', DEFAULTS.startMinimized);
        await api.settings.prefs.set('launchOnStartup', DEFAULTS.launchOnStartup);

        setMinToTray(DEFAULTS.minimizeToTray);
        setStartMinimized(DEFAULTS.startMinimized);
        setLaunchOnStartup(DEFAULTS.launchOnStartup);
      } catch {}
    });
  }, [registerReset]);

  const systemLabel = systemTheme === 'dark' ? 'Dark' : 'Light';
  const selectedLabel = 
    themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : systemLabel;

  const isOverridden = themeMode !== 'system';

  return (
    <div className="space-y-4">
      {/* Minimize to tray */}
      <div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={minToTray}
            onChange={async (e) => {
              const v = e.target.checked;
              setMinToTray(v);
              try {
                await api.settings.prefs.set('minimizeToTray', v);
              } catch {}
            }}
          />
          <span className="text-sm text-zinc-800 dark:text-zinc-300">Minimize to tray</span>
        </label>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          When enabled, clicking Minimize hides the window to the system tray.
        </div>
      </div>
      {/* Start minimized */}
      <div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={startMinimized}
            onChange={async (e) => {
              const v = e.target.checked;
              setStartMinimized(v);
              await api.settings.prefs.set('startMinimized', v);
            }}
          />
          <span className="text-sm text-zinc-800 dark:text-zinc-300">Start minimized</span>
        </label>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Launch the app hidden in the tray instead of showing the window.
        </div>
      </div>
      {/* Launch on system startup */}
      <div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={launchOnStartup}
            onChange={async (e) => {
              const v = e.target.checked;
              setLaunchOnStartup(v);
              await api.settings.prefs.set('launchOnStartup', v);
            }}
          />
          <span className="text-sm text-zinc-800 dark:text-zinc-300">Launch on system startup</span>
        </label>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Start the app automatically when you log into your computer.
        </div>
      </div>
      {/* Divider */}
      <div className='border-t border-zinc-200 dark:border-zinc-950' />
      {/* Theme blip */}
      <div>
        <div className='text-sm font-medium text-zinc-800 dark:text-zinc-300'>
          Theme
        </div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {themeMode === 'system' ? (
            <>
              Autodetected system preference:{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-300">{systemLabel}</span>
              <span className="ml-1 text-[11px] text-zinc-500">
                (following system)
              </span>
            </>
          ) : (
            <>
              Autodetected system preference:{' '}
              <span className="font-semibold text-zinc-400 dark:text-zinc-400 line-through">
                {systemLabel}
              </span>
              <span className="mx-1 text-[11px] text-zinc-500 dark:text-zinc-300">→</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-300">
                {selectedLabel} selected
              </span>
            </>
          )}
        </div>
        <button
          className="mt-2 inline-block text-xs text-blue-600 hover:underline dark:text-blue-300"
          onClick={() => {
            // switch to Appearance section in SettingsModal
            window.dispatchEvent(
              new CustomEvent('settings:navigate', {
                detail: { section: 'appearance' },
              })
            );
          }}
        >
          Manual selection →
        </button>
      </div>
    </div>
  );
}
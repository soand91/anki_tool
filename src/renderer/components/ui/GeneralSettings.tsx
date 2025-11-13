import React, { useEffect } from 'react';

type Props = {
  registerReset?: (fn: () => void | Promise<void>) => void;
};

const DEFAULTS = {
  minimizeToTray: true,
};

export default function GeneralSettings({ registerReset }: Props) {
  const api = (window as any).api;
  const [minToTray, setMinToTray] = React.useState<boolean>(DEFAULTS.minimizeToTray);

  // load current prefs on mount
  useEffect(() => {
    (async () => {
      try {
        const v = await api.settings.prefs.get('minimizeToTray');
        setMinToTray(Boolean(v));
      } catch {
        setMinToTray(DEFAULTS.minimizeToTray);
      }
    })();
  }, []);

  // Exposed reset function
  useEffect(() => {
    if (!registerReset) return;
    registerReset(async () => {
      try {
        await api.settings.prefs.set('minimizeToTray', DEFAULTS.minimizeToTray);
      } finally {
        setMinToTray(DEFAULTS.minimizeToTray);
      }
    });
  }, [registerReset]);

  return (
    <div className="space-y-4">
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
          <span className="text-sm text-zinc-800">Minimize to tray</span>
        </label>
        <div className="mt-1 text-xs text-zinc-500">
          When enabled, clicking Minimize hides the window to the system tray.
        </div>
      </div>

      {/* Stubs you can flesh out later */}
      <div className="opacity-60">
        <div className="text-sm text-zinc-800">Start minimized (coming soon)</div>
        <div className="text-xs text-zinc-500">Show the app in tray on launch.</div>
      </div>
      <div className="opacity-60">
        <div className="text-sm text-zinc-800">Launch on system startup (coming soon)</div>
        <div className="text-xs text-zinc-500">Start the app automatically after login.</div>
      </div>
    </div>
  );
}
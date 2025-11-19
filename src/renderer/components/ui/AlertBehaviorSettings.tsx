import React, { useEffect, useState } from 'react';
import {
  useSoundSettingsStore,
  setAddNoteSoundEnabled,
} from '../../state/soundSettings';

type Props = {
  registerReset: (fn: () => void | Promise<void>) => void;
};

export default function AlertBehaviorSettings({ registerReset }: Props) {
  const addNoteSounds = useSoundSettingsStore((s) => s.addNoteSounds);
  const [systemNotifications, setSystemNotifications] = useState(false);

  useEffect(() => {
    registerReset(() => {
      setAddNoteSoundEnabled(false);
      setSystemNotifications(false);
    });
  }, [registerReset]);

  return (
    <div className="space-y-4 pr-4">
      {/* Sound alerts */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-zinc-800 dark:text-zinc-300">Sound alerts</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Play a short sound when add-note succeeds or fails.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={addNoteSounds}
              onChange={(e) => setAddNoteSoundEnabled(e.target.checked)}
            />
            <span className="text-xs">{addNoteSounds ? 'On' : 'Off'}</span>
          </label>
        </div>
      </section>
      {/* System notifications */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-zinc-800 dark:text-zinc-300">System notifications</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              (coming soon) Surface desktop notifications for add-note events.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-not-allowed opacity-70">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={systemNotifications}
              disabled
              onChange={(e) => setSystemNotifications(e.target.checked)}
            />
            <span className="text-xs">{systemNotifications ? 'On' : 'Off'}</span>
          </label>
        </div>
      </section>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import Button from './Button';
import HotkeySettings from './HotkeySettings';
import GeneralSettings from './GeneralSettings';
import AppearanceSettings from './AppearanceSettings';

export type Section = 'general' | 'hotkeys' | 'alerts' | 'appearance' | 'advanced';

type ResetFn = () => void | Promise<void>;
type RegisterReset = (fn: ResetFn) => void;

export type SectionConfig = {
  id: Section;
  label: string;
  render: (props: { registerReset: RegisterReset }) => React.ReactNode;
}

export const SECTIONS: SectionConfig[] = [
  {
    id: 'general',
    label: 'General',
    render: ({ registerReset }) => <GeneralSettings registerReset={registerReset} />,
  },
  {
    id: 'hotkeys',
    label: 'Hotkeys',
    render: ({ registerReset }) => (
      <HotkeySettings mode='embedded' registerReset={registerReset} />
    ),
  },
  {
    id: 'alerts',
    label: 'Alert Behavior',
    render: ({ registerReset }) => (
      <div className='text-sm text-zinc-600'>
        Alert behavior settings coming soon
      </div>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    render: ({ registerReset }) => (
      <AppearanceSettings registerReset={registerReset} />
    ),
  },
  {
    id: 'advanced',
    label: 'Advanced',
    render: ({ registerReset }) => (
      <div className='text-sm text-zinc-600'>
        Advanced settings coming soon
      </div>
    ),
  },
]

export const SECTION_BY_ID: Record<Section, SectionConfig> = SECTIONS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<Section, SectionConfig>);

export function coerceSection(x: any, fallback: Section = 'general'): Section {
  return (SECTIONS.some(s => s.id === x) ? x : fallback) as Section;
}

export default function SettingsModal() {
  const api = (window as any).api;

  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('general');

  useEffect(() => {
    function handler(ev: any) {
      if (ev.detail?.section) {
        setSection(ev.detail.section);
      }
    }
    window.addEventListener('settings:navigate', handler);
    return () => window.removeEventListener('settings:navigate', handler);
  }, []);

  const resetHandlers = React.useRef<Partial<Record<Section, ResetFn>>>({});

  const registerReset = React.useCallback(
    (fn: ResetFn) => {
      resetHandlers.current[section] = fn;
    },
    [section]
  );

  async function handleResetCurrent() {
    const fn = resetHandlers.current[section];
    if (!fn) return;
    const currentLabel = SECTION_BY_ID[section].label;
    const ok = window.confirm(`Reset “${currentLabel}” settings to defaults?`);
    if (!ok) return;
    await fn();
  }

  // suspend hotkeys when modal is open, resume when closed
  useEffect(() => {
    if (open) {
      api.settings.hotkeys.suspend(true).catch((err: any) => {
        console.error('Failed to suspend hotkeys:', err);
      });
    } else {
      api.settings.hotkeys.suspend(false).catch((err: any) => {
        console.error('Failed to resume hotkeys:', err);
      });
    }
  }, [open]);

  useEffect(() => {
    const off = api.settings.onOpen?.((payload?: { section?: Section }) => {
      setOpen(true);
      setSection(coerceSection(payload?.section));
    });
    return () => {
      if (typeof off === 'function') off();
      if (open) {
        api.settings.hotkeys.suspend(false).catch(() => {});
      }
    };
  }, [open]);

  if (!open) return null;

  const active = SECTION_BY_ID[section]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="flex w-[750px] max-w-[95vw] h-[400px] max-h[80vh] rounded-xl bg-white shadow-xl dark:bg-[#323232]">
        {/* Left nav */}
        <div className="w-[150px] shrink-0 border-r border-zinc-200 p-3 dark:border-zinc-950">
          <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-300">Settings</div>
          <div className="flex flex-col gap-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`rounded-md px-2 py-1 text-left text-sm ${
                  section === s.id ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400' : 'text-zinc-700 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex grow flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 pl-4 pr-3 py-3 dark:border-zinc-950">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
              {active.label}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="solid" onClick={handleResetCurrent}>
                Reset to defaults
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] grow overflow-auto pl-4 py-3">
            {active.render({ registerReset })}
          </div>
        </div>
      </div>
    </div>
  );
}
// src/renderer/App.tsx
import React, { useEffect, useState } from 'react'
import { applyTheme, ThemeMode } from './components/ui/theme'
import LiveHealthPip from './components/health/LiveHealthPip'
import { useIdleSleep } from './hooks/useIdleSleep'
import { useHealthChecks } from './hooks/useHealthChecks'
import { useResizablePanels } from './hooks/useResizablePanels'
import DeckDisplay from './components/deck/DeckDisplay'
import { useDeckLifecycle } from './hooks/useDeckLifecycle'
import NotePreviewEditor from './components/note/NotePreviewEditor'
import { useNoteCapture } from './hooks/useNoteCapture'
import SettingsModal from './components/ui/SettingsModal'
import HealthModalHost from './components/health/HealthModalHost'
import { PanelLayoutPreset } from '../main/settings/prefs.store'
import { HistoryPanel } from './components/history/HistoryPanel'
import { PANEL_LAYOUT_PRESET_CHANGED_EVENT, THEME_MODE_CHANGED_EVENT } from './settingsEvents'
import ToastHost from './components/ui/ToastHost'

export function App() {
  const { idle, waking } = useIdleSleep({ idleMs: 3*60_000, pollIntervalMs: 8000 });
  const {
    rows,
    overall,
    anyFailed,
    allDone,
    startedAt,
    finishedAt,
    showHealthModal,
    setShowHealthModal,
    modalDefaultLive,
    setLivePref,
    runAllChecks
  } = useHealthChecks();

  type PanelSizes = {
    leftPanel: number,
    topRightPanel: number,
  };

  function getDefaultsForPreset(preset: PanelLayoutPreset | null | undefined): PanelSizes {
    switch (preset) {
      case 'wideDecks':
        return { leftPanel: 40, topRightPanel: 55 }
      case 'wideNotes':
        return { leftPanel: 25, topRightPanel: 70 }
      case 'balanced':
      default:
        return { leftPanel: 30, topRightPanel: 55 }
    }
  };

  const [panelDefaults, setPanelDefaults] = useState<PanelSizes>(() => getDefaultsForPreset('balanced'));
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const api = (window as any).api;
    (async () => {
      try {
        const stored = await api.settings?.prefs?.get('panelLayoutPreset');
        const preset: PanelLayoutPreset = 
          stored === 'wideDecks' || stored === 'wideNotes' || stored === 'balanced'
            ? stored
            : 'balanced';
        setPanelDefaults(getDefaultsForPreset(preset));
      } catch {
        setPanelDefaults(getDefaultsForPreset('balanced'));
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const preset = (event as CustomEvent<PanelLayoutPreset>).detail;
      if (!preset) return;
      setPanelDefaults(getDefaultsForPreset(preset));
    };
    window.addEventListener(PANEL_LAYOUT_PRESET_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(PANEL_LAYOUT_PRESET_CHANGED_EVENT, handler);
    };
  }, []);
  
  const {
    containerRef,
    leftRef,
    sizes,
    defaultSizes,
    snapThresholdPx: snapThreshold,
    isResizing,
    initResizeLeft,
    initResizeTopRight,
    isSnapped,
  } = useResizablePanels({
    defaultSizes: panelDefaults ,
    snapThresholdPx: 10
  })

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

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<ThemeMode>).detail;
      if (!next) return;
      setThemeMode(next);
      applyTheme(next);
    };
    window.addEventListener(THEME_MODE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(THEME_MODE_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    if (themeMode !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [themeMode]);
  useNoteCapture();
  useDeckLifecycle();

  const ankiconnectHealthy = overall !== 'error';

  return (
    <div
      ref={containerRef}
      className='fixed inset-0 flex flex-col md:flex-row gap-1.5 h-screen overflow-hidden border-t border-zinc-200 dark:bg-zinc-800 dark:border-zinc-950'
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      {/* LEFT PANEL */}
      <div
        ref={leftRef}
        className='h-full overflow-hidden relative flex flex-none shrink-0 dark:bg-neutral-800 dark:border-zinc-950'
        style={{ width: `${sizes.leftPanel}%` }}
      >
        <div className='flex-1 flex flex-col min-w-0'>
          <DeckDisplay/>
        </div>
      </div>
      {/* VERTICAL RESIZE HANDLE */}
      <div
        className={`resize-handle horizontal min-w-[8px] ${
          isResizing === 'left' ? 'active' : ''
        } ${isSnapped.left ? 'snapped' : ''}`}
        onMouseDown={initResizeLeft}
      />
      {/* RIGHT PANEL */}
      <div className='border-l border-zinc-200 flex flex-auto min-w-0 flex-col overflow-hidden dark:bg-neutral-800 dark:border-zinc-950'>
        {/* TOP-RIGHT */}
        <div className='overflow-hidden' style={{ height: `${sizes.topRightPanel}%` }}>
          <NotePreviewEditor ankiconnectHealthy={ankiconnectHealthy} />
        </div>
        {/* HORIZONTAL RESIZE HANDLE */}
        <div
          className={`resize-handle vertical min-h-[8px] ${
            isResizing === 'topRight' ? 'active' : ''
          } ${isSnapped.topRight ? 'snapped' : ''}`}
          onMouseDown={initResizeTopRight}
        />
        {/* BOTTOM-RIGHT */}
        <div className='overflow-hidden' style={{ height: `${100 - sizes.topRightPanel}%` }}>
          <HistoryPanel />
        </div>
      </div>
      <HealthModalHost />
      <LiveHealthPip idle={idle} waking={waking} />
      <SettingsModal />
      <ToastHost />
      {/* INLINE STYLING FOR RESIZE HANDLES */}
      <style>{`
        html, body, #root { height: 100%; }
        body { margin: 0; }
        .resize-handle {
          background-color: #e5e7eb;
          transition: background-color 0.2s;
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dark .resize-handle { background-color: #323232; }
        .resize-handle.active { background-color: #d1d5db; }
        .dark .resize-handle.active { background-color: gray; }
        .resize-handle.horizontal { cursor: col-resize; width: 8px; }
        .resize-handle.vertical { cursor: row-resize; height: 8px; }
        .resize-handle::after {
          content: '';
          position: static;
          background-color: #9ca3af;
          border-radius: 9999px;
          opacity: 0.8;
          transition: background-color 0.15s ease;
        }
        .resize-handle.active.snapped::after {
          background-color: #3b82f6
        }
        .dark .resize-handle.active.snapped::after {
          background-color: #FFFF8F
        }
        .resize-handle.horizontal::after { width: 2px; height: 60%; }
        .resize-handle.vertical::after { height: 2px; width: 60%; }
        body.resizing .resize-handle.horizontal { cursor: col-resize; user-select: none; }
        body.resizing .resize-handle.vertical { cursor: row-resize; user-select: none; }
        body.resizing { user-select: none; }
        body.resizing > :not(.resize-handle) { pointer-events: none; }
        body.resizing .resize-handle { pointer-events: auto !important; }
      `}</style>
    </div>
  )
}

export default App

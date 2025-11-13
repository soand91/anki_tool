// src/renderer/App.tsx
import React, { useEffect, useState } from 'react'
import { applyTheme, ThemeMode } from './components/ui/theme'
import LiveHealthPip from './components/health/LiveHealthPip'
import { useIdleSleep } from './hooks/useIdleSleep'
import { useHealthChecks } from './hooks/useHealthChecks'
import { useResizablePanels } from './hooks/useResizablePanels'
import HealthModal from './components/health/HealthModal'
import DeckDisplay from './components/deck/DeckDisplay'
import type { HealthStatus } from '../shared/health/types'
import { useDeckLifecycle } from './hooks/useDeckLifecycle'
import NotePreviewEditor from './components/note/NotePreviewEditor'
import { useNoteCapture } from './hooks/useNoteCapture'
import SettingsModal from './components/ui/SettingsModal'
import HealthModalHost from './components/health/HealthModalHost'

export function App() {
  useEffect(() => {
    const api = (window as any).api;
    (async () => {
      try {
        const stored = await api.settings?.prefs?.get('themeMode');
        const m: ThemeMode = 
          stored === 'light' || stored === 'dark' || stored === 'system'
            ? stored
            : 'system';
        applyTheme(m);
      } catch {
        applyTheme('system');
      }
    })();
  }, []);
  useIdleSleep({ idleMs: 3 * 60_000, pollIntervalMs: 8000 })
  useNoteCapture();

  // const [showHealthModal, setShowHealthModal] = useState(false);

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
  } = useHealthChecks()

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
    defaultSizes: { leftPanel: 30, topRightPanel: 60 },
    snapThresholdPx: 10
  })

  useDeckLifecycle();

  const ankiconnectHealthy = overall !== 'error';

  return (
    <div
      ref={containerRef}
      className='fixed inset-0 flex flex-col md:flex-row gap-1.5 h-screen overflow-hidden border-t border-zinc-200 dark:bg-zinc-800'
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
          {/* <div className='flex items-center justify-between px-3 py-1 border-b border-zinc-200'>
            <Button onClick={runAllChecks}>
              Run Checks
            </Button>
          </div> */}
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
        <div
          className='overflow-hidden'
          style={{ height: `${100 - sizes.topRightPanel}%` }}
        >
          <div className='p-4 text-sm text-zinc-600 overflow-auto'>
            Bottom-right panel content…
          </div>
        </div>
      </div>
      <HealthModalHost />
      <LiveHealthPip />
      <SettingsModal />
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
          background-color: black
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

// src/renderer/App.tsx
import React, { useState } from 'react'
import { Button } from './components/ui/Button'
import LiveHealthPip from './components/health/LiveHealthPip'
import { useIdleSleep } from './hooks/useIdleSleep'
import { useHealthChecks } from './hooks/useHealthChecks'
import { useResizablePanels } from './hooks/useResizablePanels'
import HealthModal from './components/health/HealthModal'
import type { HealthStatus } from '../shared/health/types'

export function App() {
  useIdleSleep({ idleMs: 3 * 60_000, pollIntervalMs: 8000 })

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
    defaultSizes: { leftPanel: 40, topRightPanel: 50 },
    snapThresholdPx: 10
  })

  return (
    <div
      ref={containerRef}
      className='fixed inset-0 flex flex-col md:flex-row gap-4 h-screen overflow-hidden'
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
        className='h-full overflow-hidden relative flex flex-none shrink-0'
        style={{ width: `${sizes.leftPanel}%` }}
      >
        <div className='flex-1 flex flex-col'>
          <div className='flex items-center justify-between px-4 py-2 border-b border-zinc-200'>
            <div className='font-semibold'>Decks</div>
            <button onClick={window.api.addDeck}> + </button>
            <button onClick={window.api.getDecks}>Refresh</button>
          </div>
          <div className='flex-1 p-4 overflow-auto text-sm text-zinc-600'>
            Left panel content…
          </div>
        </div>
      </div>

      {/* VERTICAL RESIZE HANDLE */}
      <div
        className={`resize-handle horizontal ${
          isResizing === 'left' ? 'active' : ''
        } ${isSnapped.left ? 'snapped' : ''}`}
        onMouseDown={initResizeLeft}
      />

      {/* RIGHT PANEL */}
      <div className='flex flex-auto min-w-0 flex-col overflow-hidden'>
        {/* TOP-RIGHT */}
        <div className='overflow-hidden' style={{ height: `${sizes.topRightPanel}%` }}>
          <div className='flex items-center justify-between px-4 py-2 border-b border-zinc-200'>
            <div className='font-semibold'>Top-Right Content</div>
            <Button onClick={runAllChecks}>
              Run Checks
            </Button>
          </div>
          <div className='p-4 text-sm text-zinc-600 overflow-auto'>
            Top-right panel content…
          </div>
        </div>

        {/* HORIZONTAL RESIZE HANDLE */}
        <div
          className={`resize-handle vertical ${
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

      {/* HEALTH MODAL */}
      {showHealthModal && (
        <HealthModal
          isOpen={showHealthModal}
          onClose={() => setShowHealthModal(false)}
          defaultLive={modalDefaultLive} // snapshot mode by default
          onLivePrefChange={setLivePref} // persist user toglle
        />
      )}
           
      <LiveHealthPip/>
      
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
        .resize-handle.active { background-color: #d1d5db; }
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

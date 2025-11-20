import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { NoteHudState, AddNoteEvent } from '../../shared/noteHud/types';
import './style.css';

const statusMap: Record<AddNoteEvent['kind'], { label: string; color: string }> = {
  start: { label: 'Adding...', color: '#d4c200' },
  success: { label: 'Added', color: '#2fb344' },
  failure: { label: 'Failed', color: '#d64545' },
};

function useNoteHudBridge() {
  const [state, setState] = useState<NoteHudState>({ latestEvent: null, history: [], draftPreview: null });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window?.api?.noteHud;
    if (!api) {
      setError('Note HUD bridge unavailable');
      return;
    }

    let unsub: (() => void) | undefined;
    let alive = true;

    api
      .getState()
      .then((initial) => {
        if (!alive) return;
        setState(initial);
        setReady(true);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message ?? 'Failed to load Note HUD state');
      });

    unsub = api.onUpdate((next) => {
      setState(next);
      setReady(true);
      setError(null);
    });

    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  return { state, ready, error };
}

function truncate(value: string | undefined | null, limit = 80) {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 3)}...`;
}

const GearIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M6 4.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm4.5 1.75-.97.38a3.6 3.6 0 0 1-.32.77l.5.9-.85.85-.9-.5a3.6 3.6 0 0 1-.77.32l-.38.97h-1l-.38-.97a3.6 3.6 0 0 1-.77-.32l-.9.5-.85-.85.5-.9a3.6 3.6 0 0 1-.32-.77L1.5 6h0l.97-.38c.07-.27.18-.53.32-.77l-.5-.9.85-.85.9.5c.24-.14.5-.25.77-.32l.38-.97h1l.38.97c.27.07.53.18.77.32l.9-.5.85.85-.5.9c.14.24.25.5.32.77l.97.38Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 3l6 6m0-6-6 6" strokeLinecap="round" />
  </svg>
);

function NoteHudApp() {
  const { state, ready, error } = useNoteHudBridge();
  const latest = state.latestEvent;
  const history = useMemo(() => state.history.slice(0, 5), [state.history]);
  const [highlight, setHighlight] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!latest) return;
    setHighlight(true);
    const timeout = window.setTimeout(() => setHighlight(false), 280);
    return () => window.clearTimeout(timeout);
  }, [latest?.timestamp]);

  const previewSource = state.draftPreview ?? (latest ? {
    deckName: latest.deckName,
    fields: latest.fields,
  } : null);

  const deckLabel = previewSource?.deckName || 'Deck?';
  const frontText = truncate(previewSource?.fields.front);
  const backText = previewSource?.fields.back ? truncate(previewSource.fields.back, 60) : undefined;

  const status = latest
    ? statusMap[latest.kind]
    : previewSource
      ? { label: 'Draft', color: '#74c0fc' }
      : null;

  const handleOpenSettings = useCallback(() => {
    (window as any)?.api?.noteHud?.openSettings?.();
  }, []);

  const handleClose = useCallback(() => {
    (window as any)?.api?.noteHud?.hide?.();
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = window.innerWidth;
    const startHeight = window.innerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (edge.includes('right')) {
        newWidth = Math.max(180, startWidth + deltaX);
      }
      if (edge.includes('left')) {
        newWidth = Math.max(180, startWidth - deltaX);
      }
      if (edge.includes('bottom')) {
        newHeight = Math.max(120, startHeight + deltaY);
      }
      if (edge.includes('top')) {
        newHeight = Math.max(120, startHeight - deltaY);
      }

      (window as any)?.api?.noteHud?.resize?.(newWidth, newHeight, edge);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className={`hud-shell${isResizing ? ' resizing' : ''}`}>
      <div className="hud-chrome">
        <div className="hud-chrome-bar" />
        <div className="hud-chrome-buttons">
          <button className="hud-icon" title="HUD Settings" onClick={handleOpenSettings}>
            <GearIcon />
          </button>
          <button className="hud-icon" title="Close HUD" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="hud-root">
        <div className={`hud-window${highlight ? ' highlight' : ''}`} data-ready={ready}>
          <header className="hud-header">
            <div className="hud-deck" title={deckLabel}>{deckLabel}</div>
            {status && (
              <span className="status-chip" style={{ color: status.color, borderColor: status.color }}>
                {status.label}
              </span>
            )}
          </header>

          {error && (
            <div className="hud-alert">
              {error} — try reopening the Note HUD.
            </div>
          )}

          <div className="hud-body">
            <section className="hud-card hud-section">
              <span className="hud-label">Front</span>
              <div className={`hud-preview-text${frontText ? '' : ' hud-placeholder'}`}>
                {frontText || '...'}
              </div>
            </section>

            {backText && (
              <section className="hud-card hud-section">
                <span className="hud-label">Back</span>
                <div className="hud-preview-text back">
                  {backText}
                </div>
              </section>
            )}
          </div>

          <section className="hud-card hud-history">
            <div className="hud-history-dots">
              {history.map((evt) => {
                const color = statusMap[evt.kind].color;
                return (
                  <span
                    key={`${evt.timestamp}-${evt.kind}`}
                    title={`${evt.deckName} - ${statusMap[evt.kind].label}`}
                    className={`hud-dot ${evt.kind}`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
              {!history.length && ready && !error && (
                <span className="hud-empty">No attempts yet</span>
              )}
              {!ready && !error && <span className="hud-empty">Waiting...</span>}
            </div>
          </section>
        </div>
      </div>

      {/* Resize handles */}
      <div className="resize-handle resize-top" onMouseDown={(e) => handleResizeStart(e, 'top')} />
      <div className="resize-handle resize-right" onMouseDown={(e) => handleResizeStart(e, 'right')} />
      <div className="resize-handle resize-bottom" onMouseDown={(e) => handleResizeStart(e, 'bottom')} />
      <div className="resize-handle resize-left" onMouseDown={(e) => handleResizeStart(e, 'left')} />
      <div className="resize-handle resize-corner resize-top-left" onMouseDown={(e) => handleResizeStart(e, 'top-left')} />
      <div className="resize-handle resize-corner resize-top-right" onMouseDown={(e) => handleResizeStart(e, 'top-right')} />
      <div className="resize-handle resize-corner resize-bottom-left" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')} />
      <div className="resize-handle resize-corner resize-bottom-right" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')} />
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<NoteHudApp />);
}

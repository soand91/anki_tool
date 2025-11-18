import React from 'react';
import { useHistory } from '../../hooks/useHistory';
import type { HistoryEntry } from '../../../shared/history/types';
import Button from '../ui/Button';
import { useDeckStore } from '../../state/deckStore';

interface HistoryPanelProps {
  selectedDeckName?: string | null;
  className?: string;
}

type ColumnDef = {
  key: string;
  header: string | null;
  widthClass: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (entry: HistoryEntry) => React.ReactNode;
};

function formatDeckLabel(raw: string, maxChars = 24): string {
  if (!raw) return '';
  if (raw.length <= maxChars) {
    return raw;
  }
  const parts = raw.split('::');
  if (parts.length < 2) {
    return raw.slice(0, maxChars - 1) + '…';
  }
  const first = parts[0];
  const last = parts[parts.length - 1];

  let candidate = `${first}…${last}`;
  if (candidate.length <= maxChars) {
    return candidate;
  }

  const roomForFirst = Math.max(3, maxChars - last.length - 1);
  const shortenedFirst = first.slice(0, roomForFirst);
  candidate = `${shortenedFirst}…${last}`;

  if (candidate.length <= maxChars) {
    return candidate;
  }

  return candidate.slice(0, maxChars - 1) + '…';
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ className = '' }) => {
  const selectedDeckName = useDeckStore(s => s.getSelectedDeckName());
  const hasDecks = useDeckStore(s => s.sortedDecks.length > 0);
  const selectedDeckLabel = selectedDeckName ?? (hasDecks ? 'Default' : 'No deck selected');
  const [filterBySelectedDeck, setFilterBySelectedDeck] = React.useState(false);
  const effectiveDeckName = filterBySelectedDeck ? selectedDeckName : null;
  const {
    entries,
    loading,
    error,
    total,
    hasMore,
    reload,
    loadMore,
  } = useHistory({
    deckName: effectiveDeckName,
    pageSize: 2,
  });

  const safeEntries = entries ?? [];
  const [hideDeleted, setHideDeleted] = React.useState(false);
  const visibleEntries = React.useMemo(() => {
    if (!hideDeleted) return safeEntries;
    return safeEntries.filter(e => !e.deleted);
  }, [safeEntries, hideDeleted]);
  const deletedCount = React.useMemo(
    () => safeEntries.filter(e => e.deleted).length,
    [safeEntries]
  );

  const columns: ColumnDef[] = [
    {
      key: 'front',
      header: 'Front',
      widthClass: 'w-[45%]',
      headerClassName: 'px-2 py-0.5 text-left',
      cellClassName: 'px-2 py-0.5 align-middle',
      render: (entry) => {
        if (entry.deleted) {
          return (
            <span className='italic text-[11px] text-zinc-700 dark:text-zinc-400'>
            (deleted)
            </span>
          );
        }
        return (
          <div 
            className='truncate text-[11px] text-zinc-800 dark:text-zinc-300'
            title={entry.frontPreview}
          >
            {entry.frontPreview || (
              <span className='text-zinc-400'>(no front)</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'back',
      header: 'Back',
      widthClass: 'w-[35%]',
      headerClassName: 'px-2 py-0.5 text-left',
      cellClassName: 'px-2 py-0.5 align-middle max-sm:hidden',
      render: (entry) => {
        if (entry.deleted) {
          return (
            <span className='italic text-[11px] text-zinc-500 dark:text-zinc-500'>
              (deleted)
            </span>
          )
        }
        return (
          <div 
            className='truncate text-[11px] text-zinc-600 dark:text-zinc-400'
            title={entry.backPreview || ''}
          >
            {entry.backPreview || (
              <span className='text-zinc-400'>(no back)</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'deck',
      header: 'Deck',
      widthClass: 'w-[20%]',
      headerClassName: 'px-4 py-0.5 text-left',
      cellClassName: 'px-2 py-0.5 align-middle text-left',
      render: (entry) => {
        if (entry.deleted) {
          return (
            <span className='italic text-[11px] text-zinc-500 dark:text-zinc-500'>
              (deleted)
            </span>
          )
        }
        const deckLabel = entry.currentDeckName || entry.deckNameAtCreate;
        return deckLabel ? (
          <span 
            className='overflow-hidden flex text-clip rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] h-[20px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
            title={deckLabel}
          >
            {formatDeckLabel(deckLabel, 18)}
          </span>
        ) : (
          <span className='text-[10px] text-zinc-400'>(unknown)</span>
        );
      },
    },
  ];

  return (
    <div className='h-full border-t border-zinc-200 flex flex-col min-h-0 mt-1.5 dark:border-zinc-950'>
      {/* Header */}
      <div className="max-h-[45.5px] flex-shrink-0 border-b border-zinc-200 mb-1.25 px-3 py-1 flex items-center justify-between gap-2 dark:border-zinc-950">
        <div className="flex flex-1 flex-col min-w-0 flex-shrink overflow-hidden">
          <h2 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-300">
            Add History
          </h2>
          <div className='flex items-center align-middle'>
            <span className='text-[11px] text-zinc-500 dark:text-zinc-400 mr-1'>
              Viewing: 
            </span>
            {/* Segmented toggle: All / Selected */}
            <div className="inline-flex items-center rounded-full bg-zinc-100 p-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 dark:bg-[#323232]">
              <button
                type="button"
                onClick={() => setFilterBySelectedDeck(false)}
                className={`rounded-full px-2 py-0.5 transition duration-200 cursor-pointer ${
                  !filterBySelectedDeck
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-500 dark:text-zinc-950'
                    : 'text-zinc-500 dark:text-zinc-500'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedDeckName) {
                    setFilterBySelectedDeck(true);
                  }
                }}
                disabled={!selectedDeckName}
                className={`max-w-[250px] truncate rounded-full px-2 py-0.5 transition duration-200 cursor-pointer ${
                  filterBySelectedDeck
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-500 dark:text-zinc-950'
                    : 'text-zinc-500 dark:text-zinc-500'
                } ${!selectedDeckName ? 'opacity-50 cursor-default' : ''}`}
              >
                {selectedDeckLabel}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {total > 0 && (
            <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
              {visibleEntries.length} / {total}
            </span>
          )}
          {hasMore && (
            <Button
              type='button'
              variant="outline"
              onClick={loadMore}
              disabled={loading}
            >
              Load more
            </Button>
          )}
          <Button
            type='button'
            variant='solid'
            onClick={() => {
              let query = 'tag:anki_tool'
              if (filterBySelectedDeck && selectedDeckName) {
                const deckEscaped = selectedDeckName.replace(/"/g, '\\"');
                query = `tag:anki_tool deck:"${deckEscaped}"`;
              }
              window.api.note
                .openInBrowserByQuery(query)
                .catch(() => {});
            }}
            disabled={loading}
          >
            Open GUI
          </Button>
          <Button
            type="button"
            variant='outline'
            onClick={async () => {
              await window.api.history.refresh(200).catch(() => {});
              reload();
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>
      {/* Body */}
      <div className='flex flex-col flex-1 min-h-0 mb-1.5'>
        {/* Table header */}
        <div className="flex-shrink-0 rounded-t-xl border border-zinc-200 ml-1.5 mr-3 pr-[7px] dark:border-zinc-950 bg-white dark:bg-[#323232]">
          {error && (
            <div className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
              History error: {error}
            </div>
          )}
          {!error && entries.length === 0 && !loading && (
            <div className="py-4 text-center text-[11px] text-zinc-400">
              No cards recorded yet. Add a note from this app to see history.
            </div>
          )}
          {!error && entries.length > 0 && (
            <table className="w-full table-fixed border-spacing-0 text-[11px]">
              <colgroup>
                {columns.map(col => (
                  <col key={col.key} className={col.widthClass} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-1 dark:text-zinc-500 dark:border-zinc-950">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={col.headerClassName ?? 'px-2 py-1 text-left'}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>

            </table>
          )}
        </div>
        {/* Table body */}
        <div className='h-full relative rounded-b-xl flex-1 border-x border-b border-zinc-200 ml-1.5 mr-3 dark:border-zinc-950 bg-white dark:bg-[#323232]'>
          <div className='h-full w-[calc(100%+13px)] -mr-3'>
            <div className='h-full pr-1 overflow-auto scrollbar'>
              {!error && entries.length > 0 && (
                <table className="w-[calc(100%-1px)] table-fixed border-separate border-spacing-0 text-[11px]">
                  <colgroup>
                    {columns.map(col => (
                      <col key={col.key} className={col.widthClass} />
                    ))}
                  </colgroup>
                  <tbody>
                    {visibleEntries.map(entry => {
                      const opacity = entry.deleted ? 'opacity-60' : '';
                      return (
                        <tr
                          key={entryKey(entry)}
                          className={`cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${opacity}`}
                          onClick={() => {
                            if (entry.deleted) return;
                            window.api.note.openInBrowserByNoteId(entry.noteId).catch(() => {});
                          }}
                        >
                          {columns.map(col => (
                            <td
                              key={col.key}
                              className={col.cellClassName ?? 'px-2 py-1 align-middle'}
                            >
                              {col.render(entry)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex-shrink-0 flex mt-3 px-3 py-3 items-center justify-between">
        <div className='text-[10px] text-zinc-400 dark:text-zinc-500'>
          {total > 0 && (
            <span>
              Showing {entries.length} of {total} entr{total === 1 ? 'y' : 'ies'}
            </span>
          )}
          {total === 0 && !loading && <span>No entries</span>}
        </div>
        <div className='flex space-x-3'>
          {hideDeleted && deletedCount > 0 && (
            <span className='text-[10px] text-zinc-400 dark:text-zinc-500'>
              {deletedCount} hidden
            </span>
          )}
          {deletedCount > 0 && (
            <label className='flex items-center gap-1 text-[10px] cursor-pointer select-none'>
              <input 
                type='checkbox'
                className='h-3 w-3 cursor-pointer'
                checked={hideDeleted}
                onChange={e => setHideDeleted(e.target.checked)}
              />
              <span className='text-[10px] text-zinc-400 dark:text-zinc-500'>
                Hide Deleted
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};

function entryKey(entry: HistoryEntry): string {
  return `${entry.noteId}-${entry.createdAt}`;
}

interface RowProps {
  entry: HistoryEntry;
}

const Row: React.FC<RowProps> = ({ entry }) => {
  const statusColor = entry.deleted ? 'bg-rose-500' : 'bg-emerald-500';
  const opacity = entry.deleted ? 'opacity-60' : '';

  const deckLabel = entry.currentDeckName || entry.deckNameAtCreate;

  return (
    <div
      className={`grid grid-cols-[16px,2.5fr,2.5fr,1.2fr] items-center gap-2 text-[11px] text-zinc-700 ${opacity}`}
    >
      {/* Status dot */}
      <div className="flex items-center justify-center">
        <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
      </div>

      {/* Front preview */}
      <div
        className="truncate text-zinc-800"
        title={entry.frontPreview}
      >
        {entry.frontPreview || <span className="text-zinc-400">(no front)</span>}
      </div>

      {/* Back preview (hidden on very small widths) */}
      <div
        className="hidden truncate text-zinc-600 sm:block"
        title={entry.backPreview || ''}
      >
        {entry.backPreview || <span className="text-zinc-400">(no back)</span>}
      </div>

      {/* Deck pill */}
      <div className="flex justify-end">
        {deckLabel ? (
          <span
            className="max-w-[140px] truncate rounded-full bg-zinc-100 px-2 py-0.5 text-right text-[10px] font-medium text-zinc-600"
            title={deckLabel}
          >
            {deckLabel}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-400">(unknown deck)</span>
        )}
      </div>
    </div>
  );
};

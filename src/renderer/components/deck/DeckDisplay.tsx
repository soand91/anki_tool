import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  useAllDecks,
  useDeckError,
  useDeckStatus,
  useLastFetchedAt,
  useSelectedDeckId, 
  useDeckStore,
} from '../../state/deckStore';
import Button from '../ui/Button';
import { useUiStore } from '../../state/ui';
import { useHealthChecks } from '../../hooks/useHealthChecks';

function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m =  Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function DeckDisplay() {
  const openHealthModal = useUiStore(s => s.openHealthModal);
  const {
    runAllChecks
  } = useHealthChecks()
  // read only selectors
  const decks = useAllDecks();
  const selectedId = useSelectedDeckId();
  const status = useDeckStatus();
  const error = useDeckError();
  const lastFetchedAt = useLastFetchedAt();

  // local ui state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const isLoading = status === 'loading';
  const isError = status === 'error';

  // Fetch decks on mount only - use ref to ensure it runs once
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      console.log('DeckDisplay: Initial refresh');
      useDeckStore.getState().refresh();
    }
  }, []);

  const headerSubtitle = useMemo(() => {
    if (isLoading) return 'Loading decks…';
    if (isError) return 'Failed to load decks.';
    return `Updated ${timeAgo(lastFetchedAt)}`;
  }, [isLoading, isError, lastFetchedAt]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      await useDeckStore.getState().create(name);
      setNewName('');
    } catch {
      // error is already set in store
    } finally {
      setCreating(false);
    }
  };

  const handleRefresh = () => {
    console.log('Manual refresh clicked');
    useDeckStore.getState().refresh({ force: true });
  };

  const handleSelect = (deckId: number) => {
    console.log('Deck selected:', deckId);
    useDeckStore.getState().select(deckId);
  };

  type TreeNode = {
    id: number;
    name: string;
    level: number;
    children: TreeNode[];
    hasChildren: boolean;
    optimistic?: boolean;
  };

  function buildDeckTree(sortedDecks: { id: number; name:string; segments: string[]; _optimistic?: boolean }[]): TreeNode[] {
    // parentKey is full path of parent, e.g. "Parent::Child"
    const byPath = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const d of sortedDecks) {
      const level = d.segments.length - 1;
      const path = d.name;
      const node: TreeNode = {
        id: d.id, 
        name: d.name,
        level,
        children: [],
        hasChildren: false,
        optimistic: d._optimistic,
      };
      byPath.set(path, node);
    }

    // wire parents/children
    for (const node of byPath.values()) {
      const segs = node.name.split('::');
      if (segs.length > 1) {
        const parentPath = segs.slice(0, segs.length - 1).join('::');
        const parent = byPath.get(parentPath);
        if (parent) {
          parent.children.push(node);
          parent.hasChildren = true;
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    // ensure children are alphabetically ordered
    const sortChildren = (n: TreeNode) => {
      n.children.sort((a, b) => a.name.localeCompare(b.name));
      n.children.forEach(sortChildren);
    };
    roots.sort((a, b) => a.name.localeCompare(b.name));
    roots.forEach(sortChildren);
    return roots;
  }

  function flattenVisible(nodes: TreeNode[], expanded: Set<number>): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (arr: TreeNode[]) => {
      for (const n of arr) {
        out.push(n);
        if (n.hasChildren && expanded.has(n.id)) {
          walk(n.children);
        }
      }
    };
    walk(nodes);
    return out;
  }

  const tree = useMemo(() => buildDeckTree(decks), [decks]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows = useMemo(() => flattenVisible(tree, expandedIds), [tree, expandedIds]);

  return (
    <div className="h-full flex flex-col border-r border-zinc-200 dark:border-zinc-950">
      {/* Header */}
      <div className="cursor-default mb-2 flex items-center justify-between px-3 py-1 border-b border-zinc-200 dark:border-zinc-950">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-800 Section dark:text-zinc-300">Decks</h2>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{headerSubtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant='outline'
            onClick={handleRefresh}
            disabled={isLoading}
            title='Refresh decks'
          >
            Refresh
          </Button>
          <Button
            variant='solid'
            onClick={() => setCreating(v => !v)}
            title='Create a new deck'
          >
            + New
          </Button>
        </div>
      </div>
      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="px-3 pb-1.5 mb-1 border-b border-zinc-200 dark:border-zinc-950 dark:bg-[#323232]">
          <label className="block text-xs text-zinc-600 mb-1 dark:text-zinc-300">
              Full deck name (supports <code className="font-mono">Parent::Child</code>)
          </label>
          <div className="flex items-center gap-1">
              <input
                className="flex-1 min-w-0 cursor-text rounded-md border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-zinc-300 h-[30px] hover:border-zinc-500 hover:bg-zinc-100 transition-all duration-200 dark:border-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-[#323232] dark:placeholder:text-zinc-400 dark:caret-zinc-100 dark:text-zinc-300 dark:bg-zinc-800 dark:focus:ring-zinc-600"
                placeholder="e.g. Inbox::Lecture 12"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  type="submit"
                  variant='solid'
                  disabled={!newName.trim()}
                >
                  Create
                </Button>
                <Button
                  type="button"
                  variant='outline'
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
          </div>
          {isError && (
            <p className="mt-2 text-xs text-red-600">
              {error ?? 'Failed to create deck.'}
            </p>
          )}
        </form>
      )}
      {/* Error banner (fetch/list) */}
      {isError && !creating && (
        <div className="px-3 py-2 border-b border-red-200 bg-red-50 text-xs text-red-700">
          {error ?? 'Failed to fetch decks.'}{' '}
          <button
            className="underline"
            onClick={handleRefresh}
          >
            Retry
          </button>
        </div>
      )}
      {/* Deck list */}
      <div className="flex-1 overflow-auto scrollbar">
        {decks.length === 0 && status !== 'loading' ? (
            <div className="p-4 text-sm text-zinc-500 Section">
              No decks found. Create one in Anki (or with “Create deck”) and refresh to begin.
            </div>
        ) : (
          <ul className="pl-2.5 pr-1 Section">
            {rows.map((n) => {
              const isSelected = n.id === selectedId;
              const canToggle = n.hasChildren;
              const isOpen = expandedIds.has(n.id);
              return (
                <li
                  key={n.id}
                  className={[
                    'select-none flex items-center justify-between rounded-xl no-underline',
                    isSelected ? 'bg-zinc-200 dark:bg-zinc-900' : 'hover:bg-zinc-200 dark:hover:bg-zinc-900',
                  ].join(' ')}
                  onClick={() => handleSelect(n.id)}
                  title={n.name}
                >
                  <div className="flex items-center min-w-0 flex-1 py-1 " style={{ paddingLeft: n.level * 14 }} >
                    {canToggle ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(n.id);
                        }}
                        className="w-5 h-5 text-xs rounded flex items-center justify-center dark:text-zinc-300"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? '−' : '＋'}
                      </button>
                    ) : (
                      <span className="w-5 h-5" />
                    )}
                    <div className="truncate text-sm text-zinc-800 flex-1 hover:underline dark:text-zinc-300">
                      {n.name.split('::').slice(-1)[0]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.optimistic && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                        syncing…
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* Footer (status) */}
      <div className="px-8 py-2 border-t border-zinc-200 text-[11px] text-zinc-500 flex items-center justify-between dark:border-zinc-950 dark:text-zinc-400">
        <button
          className="underline cursor-pointer"
          onClick={() => {
            if (typeof (window as any).api?.health?.runAllChecks === 'function') {
              (window as any).api.health.runAllChecks().catch(() => {});
            } else {
              runAllChecks();
            }
            openHealthModal();
          }}
          title="Run health checks and open report"
        >
          Open Health
        </button>
      </div>
    </div>
  );
}

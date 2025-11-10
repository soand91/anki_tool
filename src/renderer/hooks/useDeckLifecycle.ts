import { useEffect, useRef } from 'react';
import { useDeckStore } from '../state/deckStore';

type Options = {
  refreshOnMount?: boolean;
  revalidateOnFocus?: boolean;
  revalidateOnVisible?: boolean;
  revalidateOnHealthUp?: boolean;
  debounceMs?: number;
};

export function useDeckLifecycle(opts?: Options) {
  const {
    refreshOnMount = true,
    revalidateOnFocus = true,
    revalidateOnVisible = true,
    revalidateOnHealthUp = true,
    debounceMs = 300,
  } = opts ?? {};

  const refresh = useDeckStore((s) => s.refresh);

  // debounced trigger so multiple events collapse into one refresh
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<((label: string, force?: boolean) => void) | null>(null);

  triggerRef.current = (label: string, force?: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    console.log(`[DeckLifecycle] trigger requested from ${label}`, { force, ts: Date.now() });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      console.log(`[DeckLifecycle] executing refresh() (from ${label})`, { force });
      refresh(force ? { force: true } : undefined);
    }, debounceMs);
  };
  // initial mount
  useEffect(() => {
    if (!refreshOnMount) return;
    let ran = false;
    if (!ran) {
      ran = true;
      console.log('[DeckLifecycle] mount trigger');
      triggerRef.current?.('mount', false);
    } 
    return () => {
      ran = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [refreshOnMount, refresh]);
  // window focus revalidation
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const onFocus = () => triggerRef.current?.('window:focus', false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [revalidateOnFocus]);
  // tab becomes visible revalidation
  useEffect(() => {
    if (!revalidateOnVisible) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        triggerRef.current?.('document:visible', false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [revalidateOnVisible]);

  // health update flip
  const lastIsUpRef = useRef<boolean | null>(null);
  const lastTriggerTsRef = useRef(0);

  useEffect(() => {
    if (!revalidateOnHealthUp) return;
    if (!window.api?.health?.onUpdate) return;

    const MIN_INTERVAL_MS = 3000;

    const isDeckStale = () => {
      const { lastFetchedAt } = useDeckStore.getState();
      return Date.now() - lastFetchedAt > 60_000;
    };

    const looksUp = (s?: string) =>
      typeof s === 'string' &&
      /^(ok|up|healthy|available)$/i.test(s.trim());

    const off = window.api.health.onUpdate<any>((msg) => {
      if (msg?.type !== 'RUN_ALL_END') return;
      console.log('[DeckLifecycle] health:update (RUN_ALL_END)', msg);
      const isUp = looksUp(msg.overall);
      console.log('[DeckLifecycle] isUp:', isUp, 'lastIsUp:', lastIsUpRef.current);
      // Initialize on first message
      if (lastIsUpRef.current === null) {
        console.log('[DeckLifecycle] Initializing health state:', isUp ? 'UP' : 'DOWN');
        lastIsUpRef.current = isUp;
        return;
      }
      if (isUp && !lastIsUpRef.current) {
        const now = Date.now();
        const spacedOut = now - lastTriggerTsRef.current >= MIN_INTERVAL_MS;
        const stale = isDeckStale();
        if (stale && spacedOut) {
          console.log('[DeckLifecycle] health-up transition -> trigger refresh');
          lastTriggerTsRef.current = now;
          triggerRef.current?.('health-up', false);
        } else {
          console.log('[DeckLifecycle] health-up transition suppressed', { stale, spacedOut });
        }
      }
      lastIsUpRef.current = isUp;
    })
    return () => {
      try { off?.(); } catch {}
    };
  }, [revalidateOnHealthUp]);
}
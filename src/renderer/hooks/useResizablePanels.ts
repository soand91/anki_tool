import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PanelSizes = { leftPanel: number; topRightPanel: number };

export function useResizablePanels(opts?: {
  defaultSizes?: PanelSizes;
  snapThresholdPx?: number;
}) {
  const defaultSizes: PanelSizes = opts?.defaultSizes ?? { leftPanel: 30, topRightPanel: 60 };
  const snapThresholdPx = opts?.snapThresholdPx ?? 10;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRef      = useRef<HTMLDivElement | null>(null);

  const [sizes, setSizes] = useState<PanelSizes>(() => ({ ...defaultSizes }));
  const [isResizing, setIsResizing] = useState<null | 'left' | 'topRight'>(null);
  const isResizingRef = useRef<null | 'left' | 'topRight'>(null);

  const initialMouseRef = useRef<number>(0);
  const initialSizeRef = useRef<number>(0);
  const initialMouseYRef = useRef<number>(0);
  const initialTopSizeRef = useRef<number>(0);

  const [isSnapped, setIsSnapped] = useState<{ left: boolean; topRight: boolean }>({ left: true, topRight: true });

  useEffect(() => {
    setSizes({ ...defaultSizes });
    setIsSnapped({ left: true, topRight: true });
  }, [defaultSizes.leftPanel, defaultSizes.topRightPanel]);

  const resizeLeft = useCallback((e: MouseEvent) => {
    if (!containerRef.current || isResizingRef.current !== 'left') return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width;

    // Calculate how much mouse moved from initial position
    const mouseDelta = e.clientX - initialMouseRef.current;
    const deltaPct = (mouseDelta / containerW) * 100;
    
    // Apply delta to initial size
    const rawPct = initialSizeRef.current + deltaPct;
    const constrained = Math.max(20, Math.min(70, rawPct));

    // snap to default if within snapThresholdPx
    const snapDeltaPx = Math.abs((constrained - defaultSizes.leftPanel) / 100 * containerW);
    const finalPct = snapDeltaPx < snapThresholdPx ? defaultSizes.leftPanel : constrained;
    const snapped = Math.abs(finalPct - defaultSizes.leftPanel) < 0.5;
    setIsSnapped(prev => ({ ...prev, left: snapped }));
    setSizes(prev => ({ ...prev, leftPanel: finalPct }));
  }, [defaultSizes.leftPanel, snapThresholdPx]);

  // LEFT: stop
  const stopResizeLeft = useCallback(() => {
    isResizingRef.current = null;
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeLeft as any);
    document.removeEventListener('mouseup', stopResizeLeft as any);
  }, [resizeLeft]);

  const initResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Store initial mouse position and panel size
    initialMouseRef.current = e.clientX;
    initialSizeRef.current = sizes.leftPanel;

    isResizingRef.current = 'left';
    setIsResizing('left');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeLeft as any);
    document.addEventListener('mouseup', stopResizeLeft as any);
  }, [resizeLeft, stopResizeLeft, sizes.leftPanel]);

  // TOP-RIGHT: move
  const resizeTopRight = useCallback((e: MouseEvent) => {
    if (!containerRef.current || isResizingRef.current !== 'topRight') return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerH = rect.height;

    // Calculate how much mouse moved from initial position
    const mouseDelta = e.clientY - initialMouseYRef.current;
    const deltaPct = (mouseDelta / containerH) * 100;
    
    // Apply delta to initial size
    const rawPct = initialTopSizeRef.current + deltaPct;
    const constrained = Math.max(20, Math.min(80, rawPct));

    // snap to default if within snapThresholdPx
    const snapDeltaPx = Math.abs((constrained - defaultSizes.topRightPanel) / 100 * containerH);
    const finalPct = snapDeltaPx < snapThresholdPx ? defaultSizes.topRightPanel : constrained;
    const snapped = Math.abs(finalPct - defaultSizes.topRightPanel) < 0.5;
    setIsSnapped(prev => ({ ...prev, topRight: snapped }));
    setSizes(prev => ({ ...prev, topRightPanel: finalPct }));
  }, [defaultSizes.topRightPanel, snapThresholdPx]);

  // TOP-RIGHT: stop
  const stopResizeTopRight = useCallback(() => {
    isResizingRef.current = null;
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeTopRight as any);
    document.removeEventListener('mouseup', stopResizeTopRight as any);
  }, [resizeTopRight]);

  // TOP-RIGHT: mousedown -> start
  const initResizeTopRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Store initial mouse position and panel size
    initialMouseYRef.current = e.clientY;
    initialTopSizeRef.current = sizes.topRightPanel;
    
    isResizingRef.current = 'topRight';
    setIsResizing('topRight');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeTopRight as any);
    document.addEventListener('mouseup', stopResizeTopRight as any);
  }, [resizeTopRight, stopResizeTopRight, sizes.topRightPanel]);

  // safety: if resize ends outside handler 
  useEffect(() => {
    const abort = () => {
      isResizingRef.current = null;
      setIsResizing(null);
      document.body.classList.remove("resizing");
      document.removeEventListener("mousemove", resizeLeft as any);
      document.removeEventListener("mouseup", stopResizeLeft as any);
      document.removeEventListener("mousemove", resizeTopRight as any);
      document.removeEventListener("mouseup", stopResizeTopRight as any);
    };
    window.addEventListener('blur', abort);
    return () => window.removeEventListener('blur', abort);
  }, [resizeLeft, stopResizeLeft, resizeTopRight, stopResizeTopRight]);

  return {
    containerRef,
    leftRef,
    sizes,
    defaultSizes,
    snapThresholdPx,
    isResizing,
    initResizeLeft,
    initResizeTopRight,
    isSnapped,
  };
}
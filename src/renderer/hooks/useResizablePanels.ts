import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PanelSizes = { leftPanel: number; topRightPanel: number };

export function useResizablePanels(opts?: {
  defaultSizes?: PanelSizes;
  snapThresholdPx?: number;
}) {
  const defaultSizes: PanelSizes = opts?.defaultSizes ?? { leftPanel: 40, topRightPanel: 50 };
  const snapThresholdPx = opts?.snapThresholdPx ?? 10;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRef      = useRef<HTMLDivElement | null>(null);

  const [sizes, setSizes] = useState<PanelSizes>(() => ({ ...defaultSizes }));
  const [isResizing, setIsResizing] = useState<null | 'left' | 'topRight'>(null);

  // LEFT: mousedown -> start resizing
  const initResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('left');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeLeft as any);
    document.addEventListener('mouseup', stopResizeLeft as any);
  }, []);
  
  // LEFT: move
  const resizeLeft = useCallback((e: MouseEvent) => {
    if (!containerRef.current || isResizing !== 'left') return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width;

    // % position of mouse relative to container
    const rawPct = ((e.clientX - rect.left) / containerW) * 100;

    // min/max constraints in %
    const constrained = Math.max(20, Math.min(70, rawPct));

    // snap to default if within snapThresholdPx
    const deltaPx = Math.abs((constrained - defaultSizes.leftPanel) / 100 * containerW);
    const finalPct = deltaPx < snapThresholdPx ? defaultSizes.leftPanel : constrained;

    setSizes(prev => ({ ...prev, leftPanel: finalPct }));
  }, [isResizing, defaultSizes.leftPanel, snapThresholdPx]);

  // LEFT: stop
  const stopResizeLeft = useCallback(() => {
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeLeft as any);
    document.removeEventListener('mouseup', stopResizeLeft as any);
  }, [resizeLeft]);
  
  // TOP-RIGHT: mousedown -> start
  const initResizeTopRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('topRight');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeTopRight as any);
    document.addEventListener('mouseup', stopResizeTopRight as any);
  }, []);

  // TOP-RIGHT: move
  const resizeTopRight = useCallback((e: MouseEvent) => {
    if (!containerRef.current || isResizing !== 'topRight') return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerH = rect.height;

    // % position of mouse relative to container
    const rawPct = ((e.clientY - rect.top) / containerH) * 100;

    // min/max constraints in %
    const constrained = Math.max(20, Math.min(80, rawPct));

    // snap to default if within snapThresholdPx
    const deltaPx = Math.abs((constrained - defaultSizes.topRightPanel) / 100 * containerH);
    const finalPct = deltaPx < snapThresholdPx ? defaultSizes.topRightPanel : constrained;

    setSizes(prev => ({ ...prev, topRightPanel: finalPct }));
  }, [isResizing, defaultSizes.topRightPanel, snapThresholdPx]);

  // TOP-RIGHT: stop
  const stopResizeTopRight = useCallback(() => {
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeTopRight as any);
    document.removeEventListener('mouseup', stopResizeTopRight as any);
  }, [resizeTopRight]);

  // safety: if resize ends outside handler 
  useEffect(() => {
    const abort = () => {
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
  };
}
import React, { useEffect } from 'react';
import { toast, Toast, useToastStore } from '../../state/toastStore';

function ToastItem({ data }: { data: Toast }) {
  useEffect(() => {
    if (!data.autoCloseMs) return;
    const timer = window.setTimeout(() => toast.dismiss(data.id), data.autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [data]);

  const isError = data.kind === 'error';

  return (
    <div
      className={`pointer-events-auto relative w-full rounded-md border px-3 py-2 shadow-lg transition-all ${
        isError
          ? 'border-red-500/60 bg-white text-red-700 dark:bg-[#2c1d1d] dark:text-red-300'
          : 'border-emerald-400/60 bg-white text-emerald-700 dark:bg-[#1f2d27] dark:text-emerald-300'
      }`}
    >
      <button
        className="flex w-full flex-col text-left"
        onClick={() => {
          data.onClick?.();
          toast.dismiss(data.id);
        }}
      >
        {data.title && (
          <div className="text-xs font-semibold uppercase tracking-wide">
            {data.title}
          </div>
        )}
        <div className="text-sm">{data.message}</div>
      </button>
      <button
        className="flex items-center justify-center leading-[1.25] -mt-[0.22em] absolute right-1 top-0.5 rounded-full p-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(data.id);
        }}
        aria-label="Dismiss notification"
      >
        x
      </button>
    </div>
  );
}

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed top-2 right-3 z-[80] flex w-[280px] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} data={t} />
      ))}
    </div>
  );
}

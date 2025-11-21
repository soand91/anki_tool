// src/renderer/components/chrome/TitleBar.tsx
import React from 'react'

type Props = {
  hotkeyLabel?: string;
};

export function TitleBar({ hotkeyLabel }: Props) {
  const handleMinimize = () => window.api.hud.minimizeHud?.()
  const handleClose = () => window.api.hud.closeHud?.()

  return (
    <div className='drag-region flex items-center pl-2 h-5 max-h-5 overflow-hidden dark:bg-neutral-800'>
      {/* Left side: fills remaining space */}
      <div className='flex items-center h-full gap-1 overflow-hidden flex-1 pr-1'>
        <span className='flex items-center h-full text-xs leading-none text-zinc-500 dark:text-zinc-300 select-none whitespace-nowrap'>
          Last Key:
        </span>
        <span className='flex items-center h-full text-xs leading-none text-zinc-900 dark:text-zinc-300 select-none whitespace-nowrap overflow-hidden'>
          {hotkeyLabel || '—'}
        </span>
        {/* <span className='ml-auto flex items-center h-full text-[11px] leading-none text-zinc-700 dark:text-zinc-300 select-none whitespace-nowrap overflow-hidden'>
          Check
        </span> */}
      </div>
      {/* Right side: window controls */}
      <div className='flex items-center no-drag shrink-0'>
        <button
          type='button'
          onClick={handleMinimize}
          className='focus:outline-none focus:bg-zinc-300/50 dark:focus:bg-zinc-700/40 inline-flex h-5 w-8 items-center justify-center text-[10px] text-zinc-800 hover:bg-zinc-300/50 active:bg-zinc-300 dark:text-zinc-200 dark:hover:bg-zinc-700/80 hover:shadow-sm hover:shadow-zinc-400 dark:hover:shadow-zinc-100/50 dark:active:bg-zinc-700 transition-all duration-200'
        >
          —
        </button>
        <button
          type='button'
          onClick={handleClose}
          className='focus:outline-none focus:bg-red-500 dark:focus:bg-red-500/70 inline-flex h-5 w-8 items-center justify-center text-[10px] text-zinc-50 bg-red-600 hover:bg-red-500 active:bg-red-600 dark:hover:bg-red-400 dark:hover:text-zinc-800 hover:shadow-sm hover:shadow-zinc-500 dark:hover:shadow-zinc-100/50 transition-all duration-200'
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TitleBar

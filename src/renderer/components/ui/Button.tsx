import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline';
  asChild?: false;
};

function cx(...list: Array<string | false | null | undefined>) {
  return list.filter(Boolean).join(' ');
}

export default function Button(props: ButtonProps) {
  const {
    variant = 'outline',
    className,
    disabled,
    children,
    type,
    ...rest
  } = props;

  const base = 
    'flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs h-[30px] transition-all duration-200';

  const commonEnabled = 'cursor-pointer hover:shadow-sm';
  const commonDisabled = 'cursor-not-allowed opacity-90';

  const outlineEnabled = 
    'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-950 dark:bg-[#323232] dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100';
  const outlineDisabled = 'border border-zinc-200 bg-zinc-100 text-zinc-400';

  const solidEnabled = 
    'border border-transparent bg-zinc-900 text-white hover:bg-zinc-700 hover:text-zinc-200 dark:bg-zinc-400 dark:text-black dark:hover:bg-zinc-500 dark:hover:text-black dark:border dark:border-transparent';
  const solidDisabled = 'border border-transparent bg-zinc-300 text-white dark:border dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-600 dark:opacity-50';

  const variantClasses =
    variant === 'outline'
      ? cx(disabled ? outlineDisabled : outlineEnabled)
      : cx(disabled ? solidDisabled : solidEnabled)

  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      className={cx(
        base,
        disabled ? commonDisabled : commonEnabled,
        variantClasses,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
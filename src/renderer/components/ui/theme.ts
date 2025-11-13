export type ThemeMode = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

export function detectSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): EffectiveTheme {
  const effective: EffectiveTheme = 
    mode === 'system' ? detectSystemTheme() : mode;

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  return effective;
}
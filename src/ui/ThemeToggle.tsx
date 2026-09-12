import { useState } from 'react'
import { applyTheme, initialTheme, type Theme } from '../lib/theme'

/** Sun or moon, depending on where you are sitting. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme())

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      title={theme === 'dark' ? 'Switch to daylight mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to daylight mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}

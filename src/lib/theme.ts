/**
 * Light and dark.
 *
 * The whole app is re-lit by swapping the zinc and copper scales in CSS (see
 * styles/index.css), so all this has to do is set an attribute and remember the
 * choice. It starts from whatever the operating system prefers, which is the
 * right answer for somebody sitting in a bright room.
 */

export type Theme = 'dark' | 'light'

const KEY = 'miclab.theme'

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  // Native controls — selects, scrollbars, the focus ring — follow this.
  document.documentElement.style.colorScheme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* private browsing: the choice lasts for this visit only */
  }
}

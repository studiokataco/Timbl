"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: Resolved
}

const STORAGE_KEY = "theme"

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readSystem(): Resolved {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyClass(resolved: Resolved) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<Resolved>("light")

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? defaultTheme
    // Mount-only hydration from localStorage; SSR can't read it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored)
  }, [defaultTheme])

  useEffect(() => {
    const next: Resolved = theme === "system" ? readSystem() : theme
    // Sync derived state + DOM class when the user-facing theme changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolvedTheme(next)
    applyClass(next)
  }, [theme])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const next: Resolved = mq.matches ? "dark" : "light"
      setResolvedTheme(next)
      applyClass(next)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: "system",
      setTheme: () => {},
      resolvedTheme: "light",
    }
  }
  return ctx
}

const NO_FLASH_SCRIPT = `(()=>{try{var e=localStorage.getItem('${STORAGE_KEY}')||'system';var d=e==='dark'||(e==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(_){}})();`

export function ThemeNoFlashScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
    />
  )
}

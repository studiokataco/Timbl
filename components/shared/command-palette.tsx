"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { useTheme } from "next-themes"
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  Globe,
  KanbanSquare,
  LayoutList,
  Megaphone,
  Moon,
  Plus,
  Sun,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  fetchPaletteData,
  type PaletteCampaign,
  type PalettePost,
} from "@/lib/actions/palette"

/*
 * Global ⌘K command palette. Mounted once in the (app) layout. Provides:
 *   - Navigation jumps (Calendar, Posts, Kanban, Library, Awareness, Campaigns)
 *   - Quick add (deep-links to /calendar?quickAdd=1; the calendar page reads
 *     the param and opens its dialog — keeps the trigger one component)
 *   - Recent posts (last 5 viewed, persisted to localStorage)
 *   - Search across all posts + campaigns
 *   - Theme toggle
 *
 * Data is fetched lazily on first open and cached for 60s.
 */

const RECENT_KEY = "palette:recent"
const RECENT_MAX = 5
const CACHE_TTL_MS = 60_000

type CacheEntry = {
  posts: PalettePost[]
  campaigns: PaletteCampaign[]
  loadedAt: number
}

let cache: CacheEntry | null = null

function readRecentIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

/** Push a post id to the recent list. Called from PostComposerSheet on open. */
export function recordRecentPost(id: string) {
  if (typeof window === "undefined" || !id) return
  const prev = readRecentIds().filter((x) => x !== id)
  prev.unshift(id)
  const trimmed = prev.slice(0, RECENT_MAX)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed))
  } catch {
    /* swallow quota errors */
  }
}

export function CommandPalette() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ posts: PalettePost[]; campaigns: PaletteCampaign[] } | null>(
    null,
  )
  const [recentIds, setRecentIds] = useState<string[]>([])

  // ⌘K / Ctrl+K toggles open. Slash also opens unless typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if (cmdK) {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      const target = e.target as HTMLElement | null
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (e.key === "/" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Listen for the TopBar search-box click (or any UI that wants to open the
  // palette) — dispatched as a window event so we don't need React context.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("palette:open", onOpen)
    return () => window.removeEventListener("palette:open", onOpen)
  }, [])

  // Lazy-load (and refresh) data when the palette opens.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentIds(readRecentIds())
    const fresh = cache && Date.now() - cache.loadedAt < CACHE_TTL_MS
    if (fresh && cache) {
      setData({ posts: cache.posts, campaigns: cache.campaigns })
      return
    }
    let cancelled = false
    void fetchPaletteData().then((res) => {
      if (cancelled) return
      cache = { ...res, loadedAt: Date.now() }
      setData(res)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const go = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
  )

  const recentPosts = useMemo(() => {
    if (!data) return []
    const byId = new Map(data.posts.map((p) => [p.id, p]))
    return recentIds.map((id) => byId.get(id)).filter((p): p is PalettePost => !!p)
  }, [data, recentIds])

  const isDark = (theme ?? "light") === "dark"

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search posts, campaigns, or jump to a view…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => go("/calendar?quickAdd=1")}
            value="quick add new post"
          >
            <Plus />
            <span>Quick add post</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(isDark ? "light" : "dark")
            }}
            value="toggle theme dark light mode"
          >
            {isDark ? <Sun /> : <Moon />}
            <span>{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/calendar")} value="calendar">
            <CalendarIcon />
            <span>Calendar</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/posts")} value="all posts list">
            <LayoutList />
            <span>All posts</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/kanban")} value="kanban board">
            <KanbanSquare />
            <span>Kanban</span>
            <CommandShortcut>G K</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/library")} value="library templates">
            <BookOpen />
            <span>Library</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/awareness")} value="awareness days">
            <Globe />
            <span>Awareness days</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/campaigns")} value="campaigns">
            <Megaphone />
            <span>Campaigns</span>
          </CommandItem>
        </CommandGroup>

        {recentPosts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent posts">
              {recentPosts.map((p) => (
                <CommandItem
                  key={`recent-${p.id}`}
                  onSelect={() => go(`/calendar?postId=${p.id}`)}
                  value={`recent ${p.brief}`}
                >
                  <Clock />
                  <span className="truncate">{p.brief}</span>
                  <CommandShortcut>
                    {format(parseISO(p.scheduledDate), "d MMM")}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data && data.campaigns.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Campaigns">
              {data.campaigns.map((c) => (
                <CommandItem
                  key={`campaign-${c.id}`}
                  onSelect={() => go(`/campaigns/${c.slug}`)}
                  value={`campaign ${c.name}`}
                >
                  <Megaphone />
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data && data.posts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Posts">
              {data.posts
                .slice()
                .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
                .map((p) => (
                  <CommandItem
                    key={`post-${p.id}`}
                    onSelect={() => go(`/calendar?postId=${p.id}`)}
                    value={`post ${p.brief} ${p.status}`}
                  >
                    <CalendarIcon />
                    <span className="truncate">{p.brief}</span>
                    <CommandShortcut>
                      {format(parseISO(p.scheduledDate), "d MMM")}
                    </CommandShortcut>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

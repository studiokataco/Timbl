"use client"

import { useCallback, useSyncExternalStore } from "react"

export const SIDEBAR_COLLAPSED_KEY = "timbl:sidebar-collapsed"

export function useStoredFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => event.key === key && notify()
      window.addEventListener("storage", onStorage)
      window.addEventListener(`${key}:change`, notify)
      return () => {
        window.removeEventListener("storage", onStorage)
        window.removeEventListener(`${key}:change`, notify)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => false,
  )
  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, next ? "1" : "0")
      window.dispatchEvent(new Event(`${key}:change`))
    },
    [key],
  )
  return [value, set]
}

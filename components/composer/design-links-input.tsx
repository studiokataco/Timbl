"use client"

import { useState } from "react"
import { Link2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PickFromStorage } from "./pick-from-storage"
import { detectLinkProvider, faviconUrl, isValidUrl } from "@/lib/url"
import type { DesignLink } from "@/lib/schemas"

const BLANK: DesignLink = { url: "", provider: "link", source: "paste" }

/*
 * Rows live in local state so a half-typed or empty row stays put while the
 * user edits; only rows that parse as a URL are emitted upward, keeping the
 * autosave's postSchema.partial() validation happy. Mount fresh per post via
 * a `key` on the parent so the seed reflects the swapped-in draft.
 */
export function DesignLinksInput({
  value,
  onChange,
}: {
  value: DesignLink[]
  onChange: (next: DesignLink[]) => void
}) {
  const [rows, setRows] = useState<DesignLink[]>(value)

  const commit = (next: DesignLink[]) => {
    setRows(next)
    onChange(next.filter((l) => isValidUrl(l.url)))
  }

  const update = (i: number, url: string) =>
    commit(
      rows.map((l, idx) =>
        idx === i ? { ...l, url, provider: detectLinkProvider(url) } : l,
      ),
    )

  const add = () => commit([...rows, { ...BLANK }])
  const remove = (i: number) => commit(rows.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-2">
      {rows.map((link, i) => {
        const valid = isValidUrl(link.url)
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-md border border-input bg-secondary flex items-center justify-center overflow-hidden"
            >
              {valid ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={faviconUrl(link.url)}
                  alt=""
                  width={18}
                  height={18}
                  className="size-[18px]"
                  loading="lazy"
                />
              ) : (
                <Link2 className="size-4 text-muted-foreground" />
              )}
            </span>
            <Input
              value={link.url}
              onChange={(e) => update(i, e.target.value)}
              placeholder="https://drive.google.com/..."
              inputMode="url"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(i)}
              aria-label="Remove link"
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="self-start"
      >
        <Plus aria-hidden />
        Add link
      </Button>
      <PickFromStorage onPick={(links) => commit([...rows, ...links])} />
    </div>
  )
}

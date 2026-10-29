"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Controller, useForm, useWatch } from "react-hook-form"
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { BrandWizardClient } from "@/components/settings/brand-wizard"
import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { FormGroupTitle, FormRow } from "@/components/shared/form-row"
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { UnsavedBar } from "@/components/shared/unsaved-bar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { brandTagline, cadenceLabel, hasStarterName } from "@/components/settings/brand-meta"
import { ColorSwatches } from "@/components/settings/color-swatches"
import { IdentityImageField } from "@/components/settings/identity-image-field"
import { setCurrentBrand } from "@/lib/actions/brands"
import { updateBrandIdentity } from "@/lib/actions/identity"
import { parseInto } from "@/lib/forms/zod-form"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import type { BrandSummary } from "@/lib/queries/brands.server"
import { brandIdentityFormSchema, type BrandIdentityForm } from "@/lib/schemas/identity"
import { cn } from "@/lib/utils"

type Tab = "identity" | "voice"

const TABS: { key: Tab; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "voice", label: "Voice and audience" },
]

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
}

function overlayOpen() {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="menu"]')).some(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  )
}

export function BrandDetail({
  brand,
  brands,
  activeId,
  tab,
  canEdit,
}: {
  brand: BrandSummary
  brands: BrandSummary[]
  activeId: string
  tab: Tab
  canEdit: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const reduced = useReducedMotion()
  const headerRef = useRef<HTMLElement>(null)
  const [condensed, setCondensed] = useState(false)
  const [activating, startActivate] = useTransition()
  const active = brand.id === activeId
  const index = brands.findIndex((b) => b.id === brand.id)
  const prev = index > 0 ? brands[index - 1] : null
  const next = index < brands.length - 1 ? brands[index + 1] : null
  const hrefFor = (id: string) => `/settings/brands/${id}${tab === "voice" ? "?tab=voice" : ""}`
  const prevHref = prev ? hrefFor(prev.id) : null
  const nextHref = next ? hrefFor(next.id) : null

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    let root: HTMLElement | null = el.parentElement
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement
    const io = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), {
      root,
      rootMargin: "-120px 0px 0px 0px",
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || overlayOpen()) return
      const target =
        e.key === "Escape" ? "/settings/brands" : e.key === "j" ? nextHref : e.key === "k" ? prevHref : null
      if (!target) return
      e.preventDefault()
      router.push(target)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, prevHref, nextHref])

  function activate() {
    startActivate(async () => {
      const res = await setCurrentBrand(brand.id)
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't switch brand")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["posts"] })
      toast.success(`${brand.name} is now the active brand`)
      router.refresh()
    })
  }

  const primary = active ? (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium text-foreground">
      <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
      Active brand
    </span>
  ) : (
    <Button onClick={activate} disabled={activating} className="h-9">
      {activating ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRightLeft aria-hidden />}
      Make active
    </Button>
  )

  return (
    <TooltipProvider>
      <div className="flex min-h-full flex-col">
        <div className="sticky top-16 z-30 px-4 sm:px-6 lg:px-10">
          <div className="-mx-4 flex h-14 items-center gap-2 bg-background/95 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/settings/brands"
                    aria-label="Back to brands"
                    className="group grid size-9 shrink-0 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                  />
                }
              >
                <ChevronLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Back <Kbd>Esc</Kbd>
              </TooltipContent>
            </Tooltip>

            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[14px]">
              <Link
                href="/settings/brands"
                className="hidden shrink-0 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
              >
                Brands
              </Link>
              <span aria-hidden className="hidden text-muted-foreground/50 sm:block">/</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`${brand.name}, switch brand`}
                      className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary"
                    />
                  }
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {condensed && (
                      <motion.span
                        key="avatar"
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18 }}
                      >
                        <IdentityAvatar name={brand.name} src={brand.avatarUrl} color={brand.color} className="size-6 rounded-md text-[11px] after:rounded-md" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="truncate font-medium text-foreground">{brand.name}</span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-1">
                  {brands.map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      onClick={() => b.id !== brand.id && router.push(hrefFor(b.id))}
                      className="gap-2.5 py-1.5"
                    >
                      <IdentityAvatar name={b.name} src={b.avatarUrl} color={b.color} className="size-7 text-xs" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{b.name}</span>
                      {b.id === brand.id ? (
                        <Check className="size-3.5 text-foreground" aria-hidden />
                      ) : b.id === activeId ? (
                        <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            <AnimatePresence initial={false}>
              {condensed && !active && (
                <motion.div
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="shrink-0"
                >
                  <Button size="sm" onClick={activate} disabled={activating}>
                    Make active
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {brands.length > 1 && (
              <div className="hidden shrink-0 items-center gap-1 md:flex">
                <span className="px-1.5 text-[12px] tabular-nums text-muted-foreground">
                  {index + 1} of {brands.length}
                </span>
                <StepLink label={prev ? `Previous: ${prev.name}` : "First brand"} hint="K" href={prevHref}>
                  <ChevronUp className="size-4" aria-hidden />
                </StepLink>
                <StepLink label={next ? `Next: ${next.name}` : "Last brand"} hint="J" href={nextHref}>
                  <ChevronDown className="size-4" aria-hidden />
                </StepLink>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-2 sm:px-6 lg:px-10">
          <header ref={headerRef} className="mt-2 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <IdentityAvatar
                name={brand.name}
                src={brand.avatarUrl}
                color={brand.color}
                className="size-12 rounded-xl text-lg after:rounded-xl"
              />
              <div className="min-w-0">
                <h1 className="text-title-lg text-foreground text-balance">{brand.name}</h1>
                <p className="mt-0.5 line-clamp-2 max-w-[60ch] text-[14px] text-muted-foreground text-pretty">
                  {brandTagline(brand)}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                  <span>
                    {brand.channels.length
                      ? brand.channels.map((c) => CHANNEL_LABELS[c]).join(", ")
                      : "No channels yet"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{cadenceLabel(brand)}</span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">{primary}</div>
          </header>
        </div>

        <div className="sticky top-[7.5rem] z-20 bg-background/95 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:px-6 lg:px-10">
          <nav
            role="tablist"
            aria-label={`${brand.name} sections`}
            className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
          >
            {TABS.map((t) => {
              const current = t.key === tab
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  onClick={() =>
                    router.replace(`/settings/brands/${brand.id}${t.key === "voice" ? "?tab=voice" : ""}`, {
                      scroll: false,
                    })
                  }
                  className={cn(
                    "relative shrink-0 px-3 pb-3 pt-1 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {current &&
                    (reduced ? (
                      <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
                    ) : (
                      <motion.span
                        layoutId="brand-tab-indicator"
                        aria-hidden
                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground"
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      />
                    ))}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          {tab === "identity" ? (
            <BrandIdentity key={brand.id} brand={brand} canEdit={canEdit} />
          ) : (
            <BrandVoice brand={brand} active={active} onActivate={activate} activating={activating} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

function BrandIdentity({ brand, canEdit }: { brand: BrandSummary; canEdit: boolean }) {
  const [saving, startSave] = useTransition()
  const form = useForm<BrandIdentityForm>({
    defaultValues: { brandId: brand.id, name: brand.name, color: brand.color },
  })
  const { isDirty, errors } = form.formState
  const [name, color] = useWatch({ control: form.control, name: ["name", "color"] })
  const inputId = `brand-name-${brand.id}`

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(brandIdentityFormSchema, raw, form.setError)
    if (!values) return
    startSave(async () => {
      const res = await updateBrandIdentity(values)
      if (!res.ok) {
        toast.error("Couldn't save", { description: res.error })
        return
      }
      form.reset(values)
      toast.success(`${values.name} updated`)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-5xl">
      {hasStarterName(brand) && canEdit ? (
        <p className="mb-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-[13px] text-foreground">
          {"\"Default brand\" is the starter name every workspace gets. Rename it to the client or product it speaks for, so posts, the calendar and the switcher read clearly."}
        </p>
      ) : null}
      <FormRow
        title="Avatar"
        hint={canEdit ? "Shown in the brand switcher and on previews. Saves as soon as you pick one." : "Contributors can't edit brands."}
      >
        <IdentityImageField
          target={{ kind: "brand", brandId: brand.id }}
          name={name || brand.name}
          src={brand.avatarUrl}
          color={color}
          disabled={!canEdit}
        />
      </FormRow>
      <FormRow title="Name" hint="The client or product this brand speaks for." htmlFor={inputId}>
        <Input
          id={inputId}
          disabled={!canEdit}
          aria-invalid={!!errors.name}
          className="max-w-sm"
          {...form.register("name")}
        />
        {errors.name ? (
          <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">{errors.name.message}</p>
        ) : null}
      </FormRow>
      <FormRow title="Colour" hint="Tints the initials when there's no avatar.">
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorSwatches
              label={`${brand.name} colour`}
              value={field.value}
              onChange={field.onChange}
              disabled={!canEdit}
            />
          )}
        />
      </FormRow>

      <FormGroupTitle>Publishing</FormGroupTitle>
      <FormRow title="Channels" hint="Where this brand posts. Connect accounts in Integrations & API.">
        {brand.channels.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {brand.channels.map((c) => (
              <li
                key={c}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] text-foreground"
              >
                <ChannelGlyph channel={c} className="size-3.5" />
                {CHANNEL_LABELS[c]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">None yet. The voice interview asks about them.</p>
        )}
        <Link
          href="/settings/integrations"
          className="mt-3 inline-block text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
        >
          Manage connections
        </Link>
      </FormRow>
      <FormRow title="Cadence" hint="How often the planner aims to post. Tune it in the voice interview.">
        <p className="text-[14px] text-foreground">{cadenceLabel(brand)}</p>
      </FormRow>

      <UnsavedBar show={isDirty} saving={saving} onDiscard={() => form.reset()} />
    </form>
  )
}

function BrandVoice({
  brand,
  active,
  onActivate,
  activating,
}: {
  brand: BrandSummary
  active: boolean
  onActivate: () => void
  activating: boolean
}) {
  if (active) return <BrandWizardClient brandId={brand.id} />

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-foreground">
          The interview works on the active brand. Make {brand.name} active to continue it.
        </p>
        <Button size="sm" onClick={onActivate} disabled={activating} className="shrink-0">
          {activating ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRightLeft aria-hidden />}
          Make active
        </Button>
      </div>
      <FormRow title="Voice" hint="How the AI writes for this brand." className="mt-4">
        <p className="max-w-[65ch] whitespace-pre-line text-[14px] text-foreground">
          {brand.voice || <span className="text-muted-foreground">Not set yet.</span>}
        </p>
      </FormRow>
      <FormRow title="Audience" hint="Who the posts are for.">
        <p className="max-w-[65ch] whitespace-pre-line text-[14px] text-foreground">
          {brand.audience || <span className="text-muted-foreground">Not set yet.</span>}
        </p>
      </FormRow>
    </div>
  )
}

function StepLink({
  label,
  hint,
  href,
  children,
}: {
  label: string
  hint: string
  href: string | null
  children: React.ReactNode
}) {
  const className =
    "grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Link href={href} aria-label={label} className={className} />
          ) : (
            <button type="button" aria-label={label} disabled className={cn(className, "pointer-events-none opacity-40")} />
          )
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label} <Kbd>{hint}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 rounded border border-current/20 px-1 font-sans text-[10px] font-medium opacity-80">
      {children}
    </kbd>
  )
}

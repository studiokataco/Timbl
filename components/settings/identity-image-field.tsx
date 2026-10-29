"use client"

import { useRef, useState, useTransition } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { removeIdentityImage, uploadIdentityImage } from "@/lib/actions/identity"
import { IDENTITY_IMAGE_TYPES, type IdentityImageTarget } from "@/lib/schemas/identity"
import { cn } from "@/lib/utils"

const OUTPUT_SIZE = 512

async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(side, OUTPUT_SIZE)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not read that image")
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  )
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  )
  if (!blob) throw new Error("Could not process that image")
  return blob
}

export function IdentityImageField({
  target,
  name,
  src,
  color,
  shape = "square",
  disabled,
}: {
  target: IdentityImageTarget
  name: string
  src?: string
  color?: string
  shape?: "square" | "circle"
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [override, setOverride] = useState<{ value: string | undefined } | null>(null)
  const preview = override ? override.value : src
  const setPreview = (value: string | undefined) => setOverride({ value })
  const [dragging, setDragging] = useState(false)
  const [pending, startTransition] = useTransition()

  function upload(file: File | undefined) {
    if (!file || disabled) return
    if (!file.type.startsWith("image/")) {
      toast.error("Use a PNG, JPG or WebP image")
      return
    }
    const local = URL.createObjectURL(file)
    const previous = preview
    setPreview(local)
    startTransition(async () => {
      try {
        const blob = await toSquareWebp(file)
        const body = new FormData()
        body.set("kind", target.kind)
        if (target.kind === "brand") body.set("brandId", target.brandId)
        body.set("file", new File([blob], "image.webp", { type: IDENTITY_IMAGE_TYPES[2] }))
        const res = await uploadIdentityImage(body)
        if (!res.ok) throw new Error(res.error)
        setPreview(res.url ?? undefined)
        toast.success("Image updated")
      } catch (err) {
        setPreview(previous)
        toast.error(err instanceof Error ? err.message : "Upload failed")
      } finally {
        URL.revokeObjectURL(local)
      }
    })
  }

  function remove() {
    const previous = preview
    setPreview(undefined)
    startTransition(async () => {
      const res = await removeIdentityImage(target)
      if (!res.ok) {
        setPreview(previous)
        toast.error(res.error)
        return
      }
      toast.success("Image removed")
    })
  }

  const busy = pending || disabled

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files[0])
        }}
        aria-label={preview ? "Replace image" : "Upload image"}
        className={cn(
          "group relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed",
          shape === "circle" ? "rounded-full" : "rounded-xl",
        )}
      >
        <IdentityAvatar
          name={name || "?"}
          src={preview}
          color={color}
          shape={shape}
          initials={shape === "circle" ? 2 : 1}
          className={cn("size-16 text-xl", shape === "square" && "rounded-xl after:rounded-xl")}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-foreground/55 text-background opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0",
            shape === "circle" ? "rounded-full" : "rounded-xl",
            (pending || dragging) && "opacity-100",
          )}
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>

      <div className="flex flex-col items-start gap-1.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? "Replace" : "Upload"}
          </Button>
          {preview ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Cropped square.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          upload(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </div>
  )
}

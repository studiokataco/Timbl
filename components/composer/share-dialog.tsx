"use client"

import { useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Globe, Lock, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { absoluteUrl } from "@/lib/seo"
import {
  createShareLink,
  listPostShares,
  makePostPrivate,
  revokeShare,
  type ShareInfo,
} from "@/lib/actions/post-shares"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  postTitle?: string
}

export function ShareDialog({ open, onOpenChange, postId, postTitle }: ShareDialogProps) {
  const queryClient = useQueryClient()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { data: shares = [], isLoading } = useQuery<ShareInfo[]>({
    queryKey: ["post-shares", postId],
    queryFn: () => listPostShares(postId),
    enabled: open,
    staleTime: 30_000,
  })

  const linkShare = shares.find((s) => s.mode === "link" || s.mode === "public")

  function shareUrl(token: string) {
    return absoluteUrl(`/p/${token}`)
  }

  async function handleCopy(token: string, id: string) {
    await navigator.clipboard.writeText(shareUrl(token))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Link copied")
  }

  function handleCreateLink() {
    startTransition(async () => {
      const res = await createShareLink({ postId, mode: "link", role: "view" })
      if (!res.ok) {
        toast.error(res.error ?? "Could not create share link")
        return
      }
      queryClient.invalidateQueries({ queryKey: ["post-shares", postId] })
    })
  }

  function handleRevoke(shareId: string) {
    startTransition(async () => {
      const res = await revokeShare({ postId, shareId })
      if (!res.ok) {
        toast.error(res.error ?? "Could not revoke")
        return
      }
      queryClient.invalidateQueries({ queryKey: ["post-shares", postId] })
    })
  }

  function handleMakePrivate() {
    startTransition(async () => {
      const res = await makePostPrivate({ postId })
      if (!res.ok) {
        toast.error(res.error ?? "Could not make private")
        return
      }
      queryClient.invalidateQueries({ queryKey: ["post-shares", postId] })
      toast.success("Post is now private")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this post</DialogTitle>
        </DialogHeader>

        {postTitle && (
          <p className="text-sm text-muted-foreground truncate">
            Sharing: <span className="font-medium text-foreground">{postTitle}</span>
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Globe aria-hidden className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Share link with anyone</span>
            </div>

            {isLoading ? (
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            ) : linkShare ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground font-mono">
                    {shareUrl(linkShare.token)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(linkShare.token, linkShare.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy link"
                  >
                    {copiedId === linkShare.id
                      ? <Check aria-hidden className="size-4 text-green-500" />
                      : <Copy aria-hidden className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(linkShare.id)}
                    disabled={isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    aria-label="Remove link"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Anyone with this link can view and approve the post.</p>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateLink}
                disabled={isPending}
                className="self-start"
              >
                <Globe aria-hidden className="size-4" />
                Create share link
              </Button>
            )}
          </div>

          {shares.length > 0 && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMakePrivate}
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground"
              >
                <Lock aria-hidden className="size-4" />
                Make private
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">Revokes all share links immediately.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

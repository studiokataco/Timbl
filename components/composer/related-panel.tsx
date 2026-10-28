"use client"

import { useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Link2, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addRelatedPost,
  removeRelatedPost,
  fetchRelatedPosts,
  listRecentPosts,
} from "@/lib/actions/post-relations"
import type { Post } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"

interface Props {
  postId: string
  campaignId?: string
  campaignName?: string
}

function PostRow({
  post,
  onRemove,
  removing,
}: {
  post: WithId<Post>
  onRemove: () => void
  removing: boolean
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium leading-tight">
          {post.brief ?? "Untitled post"}
        </span>
        <span className="text-xs text-muted-foreground">
          {post.humanId ? `${post.humanId} - ` : ""}
          {post.scheduledDate
            ? format(parseISO(post.scheduledDate), "d MMM yyyy")
            : "No date"}
          {" - "}
          <span className="capitalize">{post.status}</span>
        </span>
      </div>
      <button
        type="button"
        aria-label="Remove relation"
        onClick={onRemove}
        disabled={removing}
        className="invisible mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:visible"
      >
        {removing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <X className="size-3.5" />
        )}
      </button>
    </div>
  )
}

export function RelatedPanel({ postId, campaignId, campaignName }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [addPending, startAdd] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { data: related = [], isLoading: loadingRelated } = useQuery({
    queryKey: ["related-posts", postId],
    queryFn: () => fetchRelatedPosts(postId),
    staleTime: 30_000,
  })

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["post-candidates", postId],
    queryFn: () => listRecentPosts(postId),
    staleTime: 60_000,
  })

  const relatedIds = new Set(related.map((p) => p.id))

  const filtered = search.trim()
    ? candidates.filter(
        (p) =>
          !relatedIds.has(p.id) &&
          (p.brief?.toLowerCase().includes(search.toLowerCase()) ||
            p.humanId?.toLowerCase().includes(search.toLowerCase()) ||
            p.blurb?.toLowerCase().includes(search.toLowerCase())),
      )
    : candidates.filter((p) => !relatedIds.has(p.id)).slice(0, 8)

  const handleAdd = (relatedId: string) => {
    startAdd(async () => {
      const res = await addRelatedPost({ postId, relatedId })
      if (!res.ok) {
        toast.error(res.error ?? "Could not add relation")
        return
      }
      void qc.invalidateQueries({ queryKey: ["related-posts", postId] })
      setSearch("")
    })
  }

  const handleRemove = async (relatedId: string) => {
    setRemovingId(relatedId)
    const res = await removeRelatedPost({ postId, relatedId })
    setRemovingId(null)
    if (!res.ok) {
      toast.error(res.error ?? "Could not remove relation")
      return
    }
    void qc.invalidateQueries({ queryKey: ["related-posts", postId] })
  }

  return (
    <Tabs defaultValue="relationships" className="flex flex-col">
      <TabsList className="shrink-0 rounded-none border-b bg-transparent px-5 justify-start gap-0 h-auto pb-0">
        <TabsTrigger
          value="relationships"
          className="rounded-none border-b-2 border-transparent pb-2 pt-1 text-xs font-medium data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Relationships
        </TabsTrigger>
        <TabsTrigger
          value="references"
          className="rounded-none border-b-2 border-transparent pb-2 pt-1 text-xs font-medium data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          References
        </TabsTrigger>
      </TabsList>

      <TabsContent value="relationships" className="mt-0 flex flex-col gap-3 px-5 py-4">
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />

        {search.trim() || !loadingCandidates ? (
          filtered.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <p className="mb-1 text-xs text-muted-foreground">
                {search.trim() ? "Results" : "Recent posts"}
              </p>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={addPending}
                  onClick={() => handleAdd(p.id)}
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                >
                  <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.brief ?? "Untitled post"}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.humanId} - {p.scheduledDate ? format(parseISO(p.scheduledDate), "d MMM") : "No date"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            search.trim() && (
              <p className="text-sm text-muted-foreground">No posts match.</p>
            )
          )
        ) : (
          <Skeleton className="h-8 w-full" />
        )}

        {loadingRelated ? (
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : related.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <p className="mb-1 text-xs text-muted-foreground">Linked posts</p>
            {related.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                onRemove={() => void handleRemove(p.id)}
                removing={removingId === p.id}
              />
            ))}
          </div>
        ) : (
          !search.trim() && (
            <p className="text-sm text-muted-foreground">
              No related posts. Search above to link one.
            </p>
          )
        )}
      </TabsContent>

      <TabsContent value="references" className="mt-0 flex flex-col gap-3 px-5 py-4">
        {campaignId ? (
          <div className="flex flex-col gap-0.5">
            <p className="mb-1 text-xs text-muted-foreground">Campaign</p>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/50">
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-sm">{campaignName ?? campaignId}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No campaign linked. Assign one from the sidebar to see references here.
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}

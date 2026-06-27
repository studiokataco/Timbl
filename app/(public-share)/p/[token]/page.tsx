import { notFound } from "next/navigation"
import { getDb } from "@/lib/auth/server-helpers"
import { resolveShareToken, approveViaShareToken } from "@/lib/actions/post-shares"
import { orgPostsPath } from "@/lib/firebase/paths"
import type { Post } from "@/lib/schemas"
import { ApproveActions } from "./approve-actions"

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicSharePage({ params }: PageProps) {
  const { token } = await params
  const resolved = await resolveShareToken(token)
  if (!resolved) notFound()

  const { orgId, postId } = resolved
  const db = getDb()
  const snap = await db.doc(`${orgPostsPath(orgId)}/${postId}`).get()
  if (!snap.exists) notFound()

  // Server-side projection: strip internal fields before any data leaves the server
  const raw = snap.data() as Partial<Post>
  const post = {
    id: postId,
    brief: raw.brief,
    detailedBrief: raw.detailedBrief,
    blurb: raw.blurb,
    hashtags: raw.hashtags ?? [],
    postType: raw.postType ?? "grid",
    scheduledDate: raw.scheduledDate,
    scheduledTime: raw.scheduledTime,
    status: raw.status ?? "idea",
    canvaUrl: raw.canvaUrl,
    designLinks: raw.designLinks ?? [],
    channelStatuses: raw.channelStatuses ?? {},
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Post review</p>
        <h1 className="text-2xl font-semibold leading-snug text-foreground">
          {post.brief ?? "Untitled post"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full border px-2.5 py-0.5 text-xs capitalize">{post.status}</span>
          {post.scheduledDate && (
            <span>Scheduled: {new Date(post.scheduledDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          )}
          <span className="capitalize">{post.postType}</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {post.detailedBrief && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Brief</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.detailedBrief}</p>
          </section>
        )}

        {post.blurb && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</h2>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-4 py-3 text-sm leading-relaxed">{post.blurb}</p>
          </section>
        )}

        {post.hashtags.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hashtags</h2>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  #{tag.replace(/^#/, "")}
                </span>
              ))}
            </div>
          </section>
        )}

        {post.canvaUrl && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Design</h2>
            <a
              href={post.canvaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Open in Canva
            </a>
          </section>
        )}

        {post.designLinks.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Design files</h2>
            <ul className="flex flex-col gap-1">
              {post.designLinks.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-4 hover:text-muted-foreground transition-colors"
                  >
                    {link.label ?? link.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Approve / Request changes */}
      <div className="mt-10 border-t pt-6">
        <ApproveActions token={token} />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Powered by Timbl
      </p>
    </div>
  )
}

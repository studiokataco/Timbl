import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgPostsPath,
  orgPostStatusHistoryPath,
  orgPublishRunsPath,
  orgSocialAccountsPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { postSchema, type Post } from "@/lib/schemas/post"
import { socialAccountSchema, type SocialAccount } from "@/lib/schemas/socialAccount"
import type { ChannelKey, ChannelStatus } from "@/lib/schemas/_shared"
import { SYSTEM_USER } from "@/lib/agents/triggers/system-user"
import { getPublisher, publishableChannels } from "./registry"
import type { Publisher, PublishResult } from "./types"

export type PublishSweepSummary = {
  postsScanned: number
  channelsAttempted: number
  published: number
  failed: number
  retried: number
  reauthNeeded: number
}

function isDue(post: Post, now: Date): boolean {
  const iso = `${post.scheduledDate}T${post.scheduledTime ?? "00:00"}:00`
  const at = new Date(iso)
  return Number.isFinite(at.getTime()) && at.getTime() <= now.getTime()
}

function targetChannels(post: Post): ChannelKey[] {
  const publishable = new Set(publishableChannels())
  return Object.entries(post.channelStatuses ?? {})
    .filter(([ch, status]) => publishable.has(ch as ChannelKey) && status === "scheduled")
    .map(([ch]) => ch as ChannelKey)
}

async function loadAccount(orgId: string, channel: ChannelKey): Promise<SocialAccount | null> {
  const snap = await getAdminDb()
    .collection(orgSocialAccountsPath(orgId))
    .where("channel", "==", channel)
    .where("status", "==", "active")
    .limit(1)
    .get()
  if (snap.empty) return null
  const parsed = socialAccountSchema.safeParse(snapToData(snap.docs[0]))
  return parsed.success ? parsed.data : null
}

async function ensureFresh(
  orgId: string,
  publisher: Publisher,
  account: SocialAccount,
  now: Date,
): Promise<SocialAccount> {
  if (!account.expiresAt || new Date(account.expiresAt).getTime() > now.getTime()) return account
  const refreshed = await publisher.refresh(account)
  await getAdminDb()
    .doc(`${orgSocialAccountsPath(orgId)}/${refreshed.id}`)
    .set(
      {
        accessTokenEnc: refreshed.accessTokenEnc,
        refreshTokenEnc: refreshed.refreshTokenEnc ?? null,
        expiresAt: refreshed.expiresAt ?? null,
        status: refreshed.status,
        updatedAt: refreshed.updatedAt,
      },
      { merge: true },
    )
  return refreshed
}

async function recordRun(
  orgId: string,
  postId: string,
  channel: ChannelKey,
  result: PublishResult | { kind: "error"; reason: string },
  latencyMs: number,
): Promise<void> {
  const ref = getAdminDb().collection(orgPublishRunsPath(orgId)).doc()
  await ref.set({
    id: ref.id,
    organizationId: orgId,
    postId,
    channel,
    kind: result.kind,
    reason: "reason" in result ? result.reason : undefined,
    externalId: result.kind === "ok" ? result.externalId : undefined,
    latencyMs,
    at: new Date().toISOString(),
  })
}

async function publishOne(
  orgId: string,
  post: Post,
  channel: ChannelKey,
  now: Date,
): Promise<{ status: ChannelStatus | null; reauth: boolean }> {
  const publisher = getPublisher(channel)
  if (!publisher) return { status: null, reauth: false }

  const started = Date.now()
  const account = await loadAccount(orgId, channel)
  if (!account) {
    await recordRun(orgId, post.id, channel, { kind: "retry", reason: "no connected account" }, Date.now() - started)
    return { status: null, reauth: false }
  }

  let result: PublishResult
  try {
    const fresh = await ensureFresh(orgId, publisher, account, now)
    result = await publisher.publish(fresh, post)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await recordRun(orgId, post.id, channel, { kind: "error", reason }, Date.now() - started)
    return { status: null, reauth: false }
  }

  await recordRun(orgId, post.id, channel, result, Date.now() - started)

  if (result.kind === "needs_reauth") {
    await getAdminDb()
      .doc(`${orgSocialAccountsPath(orgId)}/${account.id}`)
      .set({ status: "needs_reauth", updatedAt: new Date().toISOString() }, { merge: true })
    return { status: null, reauth: true }
  }
  if (result.kind === "ok") return { status: "published", reauth: false }
  if (result.kind === "bad_body") return { status: "failed", reauth: false }
  return { status: null, reauth: false } // retry — leave scheduled
}

async function processPost(orgId: string, post: Post, now: Date, summary: PublishSweepSummary): Promise<void> {
  const channels = targetChannels(post)
  if (channels.length === 0) return

  const patch: Record<string, ChannelStatus> = {}
  let anyPublished = false

  for (const channel of channels) {
    summary.channelsAttempted++
    const { status, reauth } = await publishOne(orgId, post, channel, now)
    if (reauth) summary.reauthNeeded++
    if (status === "published") {
      patch[channel] = "published"
      anyPublished = true
      summary.published++
    } else if (status === "failed") {
      patch[channel] = "failed"
      summary.failed++
    } else {
      summary.retried++
    }
  }

  const db = getAdminDb()
  const merged = { ...(post.channelStatuses ?? {}), ...patch }
  /* Terminal once no publishable channel is still "scheduled". */
  const allTerminal = targetChannels({ ...post, channelStatuses: merged } as Post).length === 0

  const update: Record<string, unknown> = {
    channelStatuses: merged,
    updatedAt: new Date().toISOString(),
  }
  if (anyPublished && !post.postedAt) update.postedAt = new Date().toISOString()
  if (allTerminal) update.status = "posted"

  const ref = db.doc(`${orgPostsPath(orgId)}/${post.id}`)
  const batch = db.batch()
  batch.set(ref, update, { merge: true })
  if (allTerminal) {
    batch.set(db.collection(orgPostStatusHistoryPath(orgId, post.id)).doc(), {
      from: post.status,
      to: "posted",
      userId: SYSTEM_USER.id,
      at: new Date().toISOString(),
    })
  }
  await batch.commit()
}

export async function runPublishSweepForOrg(orgId: string, now = new Date()): Promise<PublishSweepSummary> {
  const summary: PublishSweepSummary = {
    postsScanned: 0,
    channelsAttempted: 0,
    published: 0,
    failed: 0,
    retried: 0,
    reauthNeeded: 0,
  }

  const snap = await getAdminDb()
    .collection(orgPostsPath(orgId))
    .where("status", "==", "scheduled")
    .limit(200)
    .get()

  for (const doc of snap.docs) {
    const parsed = postSchema.safeParse(snapToData(doc))
    if (!parsed.success) continue
    const post = parsed.data
    if (!isDue(post, now) || targetChannels(post).length === 0) continue
    summary.postsScanned++
    await processPost(orgId, post, now, summary)
  }

  return summary
}

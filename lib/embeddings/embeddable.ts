import { createHash } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  awarenessDaysPath,
  orgAgentMemoryPath,
  orgCampaignsPath,
  orgPostsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"

import { embed, currentEmbeddingModel } from "./provider"

/*
 * Single source of truth for "what text drives similarity for this kind"
 * and "where do its docs live." The retrieve API and embedIfChanged both
 * consume this - no other module knows the field-to-text mapping.
 */

export type Kind = "post" | "campaign" | "template" | "awarenessDay" | "agentMemory"

export function collectionPathFor(kind: Kind, orgId: string): string {
  switch (kind) {
    case "post":
      return orgPostsPath(orgId)
    case "campaign":
      return orgCampaignsPath(orgId)
    case "template":
      return orgTemplatesPath(orgId)
    case "awarenessDay":
      return awarenessDaysPath
    case "agentMemory":
      return orgAgentMemoryPath(orgId)
  }
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined
}

function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

export function toEmbeddingText(kind: Kind, doc: Record<string, unknown>): string {
  switch (kind) {
    case "post": {
      return [
        asStr(doc.brief),
        asStr(doc.detailedBrief),
        asStr(doc.blurb),
        asStrArr(doc.hashtags).join(" "),
      ]
        .filter(Boolean)
        .join("\n")
        .trim()
    }
    case "campaign":
      return [asStr(doc.name), asStr(doc.description)].filter(Boolean).join("\n").trim()
    case "template":
      return [asStr(doc.name), asStr(doc.blurbTemplate)].filter(Boolean).join("\n").trim()
    case "awarenessDay":
      return [asStr(doc.name), asStr(doc.description)].filter(Boolean).join("\n").trim()
    case "agentMemory":
      return [asStr(doc.topic), asStr(doc.body)].filter(Boolean).join("\n").trim()
  }
}

export function sourceHash(text: string): string {
  return createHash("sha1").update(text).digest("hex")
}

export type EmbedStatus = "wrote" | "skipped-empty" | "skipped-hash" | "soft-failed"

/*
 * Embed iff the source text changed since last write. Soft-fails: any
 * provider error is logged but doesn't throw - embedding is a derived
 * convenience, never load-bearing for the write that triggered it. The
 * returned status lets the backfill seed log per-doc without re-deriving.
 */
export async function embedIfChanged(
  kind: Kind,
  orgId: string,
  id: string,
  doc: Record<string, unknown>,
): Promise<EmbedStatus> {
  const text = toEmbeddingText(kind, doc)
  if (!text) return "skipped-empty"

  const hash = sourceHash(text)
  const existing = doc.embedding as
    | { sourceHash?: string; model?: string }
    | undefined
  /* Skip only when BOTH the source text AND the embedding model are
   * unchanged. A model switch (§6.7) leaves the hash identical but must
   * still trigger a re-embed - otherwise stale-model vectors linger and
   * retrieve() silently filters them out. */
  if (
    existing?.sourceHash === hash &&
    existing.model === currentEmbeddingModel()
  ) {
    return "skipped-hash"
  }

  let result: { vector: number[]; dim: number; model: string }
  try {
    result = await embed(text)
  } catch (err) {
    console.warn(
      `[embed] soft-fail kind=${kind} id=${id} - ${err instanceof Error ? err.message : String(err)}`,
    )
    return "soft-failed"
  }

  await getAdminDb()
    .doc(`${collectionPathFor(kind, orgId)}/${id}`)
    .set(
      {
        embedding: {
          vector: result.vector,
          dim: result.dim,
          model: result.model,
          sourceHash: hash,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    )
  return "wrote"
}

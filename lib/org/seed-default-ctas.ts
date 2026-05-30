import "server-only"

import type { Firestore } from "firebase-admin/firestore"

import { orgCtasPath } from "@/lib/firebase/paths"
import { DEFAULT_CTAS } from "@/lib/org/default-ctas"

export async function seedDefaultCtasIfEmpty(
  db: Firestore,
  orgId: string,
): Promise<string[]> {
  const ctaCol = db.collection(orgCtasPath(orgId))
  if (!(await ctaCol.limit(1).get()).empty) return []

  const now = new Date().toISOString()
  const installed: string[] = []
  for (const cta of DEFAULT_CTAS) {
    await ctaCol.doc(cta.slug).set(
      {
        id: cta.slug,
        organizationId: orgId,
        slug: cta.slug,
        label: cta.label,
        description: cta.description,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
    installed.push(cta.slug)
  }
  return installed
}

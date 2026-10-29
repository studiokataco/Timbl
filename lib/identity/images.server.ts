import "server-only"

import { randomUUID } from "node:crypto"

import { getAdminStorage } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import type { IdentityImageTarget } from "@/lib/schemas/identity"

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

function identityBucket() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "timbl-dev"
  return getAdminStorage().bucket(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
  )
}

function downloadBase(bucket: string) {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  const origin = emulator ? `http://${emulator}` : "https://firebasestorage.googleapis.com"
  return `${origin}/v0/b/${bucket}/o/`
}

function objectPath(orgId: string, target: IdentityImageTarget, ext: string) {
  const owner = target.kind === "brand" ? `brand-${target.brandId}` : target.kind
  return `${orgPath(orgId)}/identity/${owner}-${randomUUID()}.${ext}`
}

/* Token URLs work without a signed-in Storage client, which the dev shim and
 * session-cookie auth never have. */
export async function saveIdentityImage(
  orgId: string,
  target: IdentityImageTarget,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = identityBucket()
  const path = objectPath(orgId, target, EXT[contentType] ?? "img")
  const token = randomUUID()
  await bucket.file(path).save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  return `${downloadBase(bucket.name)}${encodeURIComponent(path)}?alt=media&token=${token}`
}

export async function deleteIdentityImage(orgId: string, url: string | undefined) {
  if (!url) return
  const bucket = identityBucket()
  const base = downloadBase(bucket.name)
  if (!url.startsWith(base)) return
  const path = decodeURIComponent(url.slice(base.length).split("?")[0])
  if (!path.startsWith(`${orgPath(orgId)}/identity/`)) return
  await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined)
}

"use server"

import { revalidatePath } from "next/cache"

import {
  getCurrentOrgId,
  getCurrentUser,
  getDb,
} from "@/lib/auth/server-helpers"
import { readBrand, writeBrand } from "@/lib/brand/brand-store"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import { deleteIdentityImage, saveIdentityImage } from "@/lib/identity/images.server"
import type { ServerActionResult } from "@/lib/schemas"
import type { BrandConfig } from "@/lib/schemas/brandConfig"
import {
  brandIdentityFormSchema,
  IDENTITY_IMAGE_MAX_BYTES,
  IDENTITY_IMAGE_TYPES,
  identityImageTargetSchema,
  profileFormSchema,
  workspaceIdentityFormSchema,
  type IdentityImageTarget,
} from "@/lib/schemas/identity"

type ImageResult = { ok: true; url: string | null } | { ok: false; error: string }

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input"
}

async function userDocRef(orgId: string) {
  const user = await getCurrentUser()
  const ref = getDb().doc(`${orgUsersPath(orgId)}/${user.id}`)
  const snap = await ref.get()
  const now = new Date().toISOString()
  /* Users created by the dev shim or before invites existed have no doc yet;
   * seed the fields every users-list reader assumes are present. */
  const base = snap.exists
    ? { updatedAt: now }
    : {
        id: user.id,
        organizationId: orgId,
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
        defaultCategories: [],
        createdAt: now,
        updatedAt: now,
      }
  return { ref, base, current: snap.data() ?? {} }
}

/* A legacy default brand still lives at /brandConfig/default; writing a partial
 * patch to /brands/default would shadow it with a doc that fails to parse. */
async function patchBrand(orgId: string, brandId: string, patch: Record<string, unknown>) {
  const existing = await readBrand(orgId, brandId)
  if (!existing) return false
  await writeBrand(orgId, { ...existing, ...patch } as Partial<BrandConfig>, brandId)
  return true
}

async function currentImageUrl(orgId: string, target: IdentityImageTarget) {
  if (target.kind === "user") return (await userDocRef(orgId)).current.avatarUrl as string | undefined
  if (target.kind === "workspace") {
    return (await getDb().doc(orgPath(orgId)).get()).data()?.logoUrl as string | undefined
  }
  return (await readBrand(orgId, target.brandId))?.avatarUrl
}

async function writeImageUrl(orgId: string, target: IdentityImageTarget, url: string | null) {
  const { FieldValue } = await import("firebase-admin/firestore")
  const value = url ?? FieldValue.delete()
  if (target.kind === "user") {
    const { ref, base } = await userDocRef(orgId)
    await ref.set({ ...base, avatarUrl: value }, { merge: true })
    return
  }
  if (target.kind === "workspace") {
    await getDb()
      .doc(orgPath(orgId))
      .set({ logoUrl: value, updatedAt: new Date().toISOString() }, { merge: true })
    return
  }
  await patchBrand(orgId, target.brandId, { avatarUrl: value })
}

const WORKSPACE_ROLES = ["admin"] as const
const BRAND_ROLES = ["admin", "editor"] as const

async function hasRole(allowed: readonly string[]) {
  return allowed.includes((await getCurrentUser()).role)
}

async function authorizeTarget(orgId: string, target: IdentityImageTarget): Promise<string | null> {
  if (target.kind === "workspace" && !(await hasRole(WORKSPACE_ROLES))) {
    return "Only workspace admins can change the workspace logo"
  }
  if (target.kind === "brand") {
    if (!(await hasRole(BRAND_ROLES))) return "Only admins and editors can change brands"
    if (!(await readBrand(orgId, target.brandId))) return "Brand not found"
  }
  return null
}

export async function updateProfile(input: unknown): Promise<ServerActionResult> {
  const parsed = profileFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const orgId = await getCurrentOrgId()
  const { ref, base } = await userDocRef(orgId)
  await ref.set({ ...base, name: parsed.data.name }, { merge: true })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateWorkspaceIdentity(input: unknown): Promise<ServerActionResult> {
  const parsed = workspaceIdentityFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  if (!(await hasRole(WORKSPACE_ROLES))) {
    return { ok: false, error: "Only workspace admins can edit the workspace" }
  }
  const orgId = await getCurrentOrgId()
  await getDb()
    .doc(orgPath(orgId))
    .set(
      {
        name: parsed.data.name,
        ...(parsed.data.color ? { primaryColor: parsed.data.color } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  revalidatePath("/", "layout")
  return { ok: true, id: orgId }
}

export async function updateBrandIdentity(input: unknown): Promise<ServerActionResult> {
  const parsed = brandIdentityFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  if (!(await hasRole(BRAND_ROLES))) {
    return { ok: false, error: "Only admins and editors can edit brands" }
  }
  const orgId = await getCurrentOrgId()
  const { brandId, name, color } = parsed.data
  const saved = await patchBrand(orgId, brandId, { name, ...(color ? { color } : {}) })
  if (!saved) return { ok: false, error: "Brand not found" }
  revalidatePath("/", "layout")
  return { ok: true, id: brandId }
}

export async function uploadIdentityImage(formData: FormData): Promise<ImageResult> {
  const parsedTarget = identityImageTargetSchema.safeParse({
    kind: formData.get("kind"),
    brandId: formData.get("brandId") ?? undefined,
  })
  if (!parsedTarget.success) return { ok: false, error: "Unknown image target" }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Choose an image to upload" }
  if (!(IDENTITY_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use a PNG, JPG or WebP image" }
  }
  if (file.size > IDENTITY_IMAGE_MAX_BYTES) {
    return { ok: false, error: "That image is too large. Try one under 1 MB" }
  }

  const target = parsedTarget.data
  const orgId = await getCurrentOrgId()
  const denied = await authorizeTarget(orgId, target)
  if (denied) return { ok: false, error: denied }

  const previous = await currentImageUrl(orgId, target)
  let url: string
  try {
    url = await saveIdentityImage(orgId, target, Buffer.from(await file.arrayBuffer()), file.type)
  } catch (err) {
    console.error("[identity] image upload failed", err)
    return { ok: false, error: "Couldn't store that image. Try again in a moment" }
  }
  await writeImageUrl(orgId, target, url)
  await deleteIdentityImage(orgId, previous)
  revalidatePath("/", "layout")
  return { ok: true, url }
}

export async function removeIdentityImage(input: unknown): Promise<ImageResult> {
  const parsed = identityImageTargetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown image target" }
  const orgId = await getCurrentOrgId()
  const denied = await authorizeTarget(orgId, parsed.data)
  if (denied) return { ok: false, error: denied }
  const previous = await currentImageUrl(orgId, parsed.data)
  await writeImageUrl(orgId, parsed.data, null)
  await deleteIdentityImage(orgId, previous)
  revalidatePath("/", "layout")
  return { ok: true, url: null }
}

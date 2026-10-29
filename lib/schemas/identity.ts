import { z } from "zod"

export const IDENTITY_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#db2777",
  "#64748b",
] as const

export const identityColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Pick a colour from the list")

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, "Add your name").max(80, "Keep it under 80 characters"),
})
export type ProfileForm = z.infer<typeof profileFormSchema>

export const workspaceIdentityFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Add a workspace name")
    .max(80, "Keep it under 80 characters"),
  color: identityColor.optional(),
})
export type WorkspaceIdentityForm = z.infer<typeof workspaceIdentityFormSchema>

export const brandIdentityFormSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().trim().min(1, "Add a brand name").max(120, "Keep it under 120 characters"),
  color: identityColor.optional(),
})
export type BrandIdentityForm = z.infer<typeof brandIdentityFormSchema>

export const identityImageTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user") }),
  z.object({ kind: z.literal("workspace") }),
  z.object({ kind: z.literal("brand"), brandId: z.string().min(1) }),
])
export type IdentityImageTarget = z.infer<typeof identityImageTargetSchema>

export const IDENTITY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const IDENTITY_IMAGE_MAX_BYTES = 900 * 1024

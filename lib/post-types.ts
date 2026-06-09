import type { PostType } from "@/lib/schemas"
import { POST_TYPE_LABELS, labelOr } from "@/lib/labels/enums"

export function getPostTypes(post: {
  postType?: PostType
  postTypes?: PostType[]
}): PostType[] {
  if (post.postTypes?.length) return post.postTypes
  return [post.postType ?? "grid"]
}

export function withSyncedPostTypes(types: PostType[]): {
  postTypes: PostType[]
  postType: PostType
} {
  const unique = [...new Set(types)]
  const postTypes = unique.length > 0 ? unique : (["grid"] as PostType[])
  return { postTypes, postType: postTypes[0] }
}

export function formatPostTypes(post: {
  postType?: PostType
  postTypes?: PostType[]
}): string {
  return getPostTypes(post)
    .map((t) => labelOr(POST_TYPE_LABELS, t))
    .join(", ")
}

import type { ChannelKey } from "@/lib/schemas/_shared"
import { linkedinPublisher } from "./providers/linkedin"
import { xPublisher } from "./providers/x"
import { facebookPublisher, instagramPublisher } from "./providers/meta"
import type { Publisher } from "./types"

/* Adding a platform = one import + one array entry. */
const publishers: Publisher[] = [
  linkedinPublisher,
  xPublisher,
  facebookPublisher,
  instagramPublisher,
]

export function getPublisher(key: string): Publisher | undefined {
  return publishers.find((p) => p.key === key)
}

export function publishableChannels(): ChannelKey[] {
  return publishers.map((p) => p.key)
}

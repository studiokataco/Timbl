import { Globe, Users } from "lucide-react"
import { FacebookIcon, InstagramIcon, LinkedInIcon, XIcon } from "@/components/marketing/brand-icons"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { tw } from "../lib"
import type { ChannelKey } from "../types"

const BRAND = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
} as const

export function ChannelMark({ channel, className = "size-4" }: { channel: ChannelKey; className?: string }): React.JSX.Element {
  const label = CHANNEL_LABELS[channel]
  const Brand = channel in BRAND ? BRAND[channel as keyof typeof BRAND] : null
  return (
    <span title={label} aria-label={label} className={tw("timbl-mark inline-flex shrink-0", channel === "x" && "dark:invert", className)}>
      {Brand ? (
        <Brand aria-hidden />
      ) : channel === "website" ? (
        <Globe aria-hidden />
      ) : (
        <Users aria-hidden />
      )}
    </span>
  )
}

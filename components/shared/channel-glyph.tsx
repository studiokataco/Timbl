import type { SVGProps } from "react"
import { Globe, Users } from "lucide-react"

import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/marketing/brand-icons"
import { CHANNEL_LABELS } from "@/lib/channels"
import type { ChannelKey } from "@/lib/schemas"
import { cn } from "@/lib/utils"

const GLYPHS: Record<ChannelKey, (props: SVGProps<SVGSVGElement>) => React.ReactNode> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  fb_groups: (props) => <Users {...props} />,
  website: (props) => <Globe {...props} />,
}

export function ChannelGlyph({
  channel,
  className,
}: {
  channel: ChannelKey
  className?: string
}) {
  const Glyph = GLYPHS[channel]
  if (!Glyph) return null
  return (
    <span title={CHANNEL_LABELS[channel]} className={cn("inline-flex", className)}>
      <Glyph aria-hidden className="size-full" />
    </span>
  )
}

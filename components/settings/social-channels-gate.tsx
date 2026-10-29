import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { ListGroup, ListPanel, ListRow } from "@/components/shared/list-panel"
import { LogoTile } from "@/components/settings/integrations-bits"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import type { ChannelKey } from "@/lib/schemas/_shared"
import { cn } from "@/lib/utils"

const PLATFORMS: ChannelKey[] = ["linkedin", "x", "facebook", "instagram"]

export function SocialChannelsGate() {
  return (
    <ListPanel>
      <ListGroup>
        {PLATFORMS.map((key) => (
          <ListRow
            key={key}
            muted
            leading={
              <LogoTile className={cn("opacity-60 grayscale", key === "x" && "dark:[&>*]:invert")}>
                <ChannelGlyph channel={key} />
              </LogoTile>
            }
            title={CHANNEL_LABELS[key]}
            subtitle="Not available yet"
          />
        ))}
      </ListGroup>
    </ListPanel>
  )
}

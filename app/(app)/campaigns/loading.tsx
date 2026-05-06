import { TopBar } from "@/components/shared/top-bar"
import { CampaignsSkeleton } from "@/components/shared/page-skeletons"

export default function Loading() {
  return (
    <>
      <TopBar />
      <CampaignsSkeleton />
    </>
  )
}

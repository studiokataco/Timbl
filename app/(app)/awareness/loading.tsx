import { TopBar } from "@/components/shared/top-bar"
import { AwarenessSkeleton } from "@/components/shared/page-skeletons"

export default function Loading() {
  return (
    <>
      <TopBar />
      <AwarenessSkeleton />
    </>
  )
}

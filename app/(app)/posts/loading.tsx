import { TopBar } from "@/components/shared/top-bar"
import { ListSkeleton } from "@/components/shared/page-skeletons"

export default function Loading() {
  return (
    <>
      <TopBar />
      <ListSkeleton />
    </>
  )
}

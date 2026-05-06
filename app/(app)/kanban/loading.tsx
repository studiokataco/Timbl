import { TopBar } from "@/components/shared/top-bar"
import { KanbanSkeleton } from "@/components/shared/page-skeletons"

export default function Loading() {
  return (
    <>
      <TopBar />
      <KanbanSkeleton />
    </>
  )
}

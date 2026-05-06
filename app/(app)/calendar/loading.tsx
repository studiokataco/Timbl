import { TopBar } from "@/components/shared/top-bar"
import { CalendarSkeleton } from "@/components/shared/page-skeletons"

export default function Loading() {
  return (
    <>
      <TopBar />
      <CalendarSkeleton />
    </>
  )
}

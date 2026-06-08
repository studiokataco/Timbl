import { AssistantChat } from "@/components/control/assistant-chat"
import { PageHeading } from "@/components/control/widgets"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"

export const dynamic = "force-dynamic"

export default async function AssistantPage() {
  await requirePlatformAdmin()
  return (
    <div>
      <PageHeading
        title="Assistant"
        description="Ask questions about platform usage, cost, tenants, and ops. Answers are grounded in live telemetry - every figure comes from a real query."
      />
      <AssistantChat />
    </div>
  )
}

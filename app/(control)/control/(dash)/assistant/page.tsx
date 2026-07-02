import { AssistantChat } from "@/components/control/assistant-chat"
import { DiagnosticsPanel } from "@/components/control/diagnostics-panel"
import { PageHeading } from "@/components/control/widgets"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { getRecentDiagnostics } from "@/lib/platform/queries"

export const dynamic = "force-dynamic"

export default async function AssistantPage() {
  await requirePlatformAdmin()
  const runs = await getRecentDiagnostics()
  return (
    <div>
      <PageHeading
        title="Assistant"
        description="Ask questions about platform usage, cost, tenants, and ops. Answers are grounded in live telemetry - every figure comes from a real query."
      />
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="chat">
          <AssistantChat />
        </TabsContent>
        <TabsContent value="diagnostics">
          <DiagnosticsPanel runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

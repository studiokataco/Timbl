import { ShieldAlert } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = { robots: { index: false, follow: false } }

export default function SuspendedPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
          Workspace suspended
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace has been suspended. If you think this is a mistake,
          contact your account manager to have it reactivated.
        </p>
      </div>
    </div>
  )
}

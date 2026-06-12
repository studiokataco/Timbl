import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Access pending",
  robots: { index: false, follow: false },
}

export default function AccessPendingPage() {
  return (
    <AuthCard className="space-y-6 text-center">
      <h1 className="text-xl font-medium text-foreground">Access pending</h1>
      <p className="text-sm text-foreground/75">
        You signed in with an allowed email, but an admin still needs to approve
        your workspace access. You will get in after approval - sign in again then.
      </p>
      <Link href="/login" className="inline-flex">
        <Button variant="outline" className="border-border bg-input/50 hover:bg-input/70">
          Back to sign in
        </Button>
      </Link>
    </AuthCard>
  )
}

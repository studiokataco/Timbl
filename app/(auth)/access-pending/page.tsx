import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function AccessPendingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-medium">Access pending</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You signed in with an allowed email, but an admin still needs to approve
        your workspace access. You will get in after approval - sign in again then.
      </p>
      <Link href="/login" className="mt-6 inline-flex">
        <Button variant="outline">Back to sign in</Button>
      </Link>
    </main>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { ClaimAccessForm } from "@/components/auth/claim-access-form"
import { Button } from "@/components/ui/button"
import { getApprovedBetaInvite } from "@/lib/auth/beta-access"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Create your login",
  description: "Set up your Timbl account after beta approval.",
  robots: { index: false, follow: false },
}

export default async function ClaimAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email: rawEmail } = await searchParams
  const email = rawEmail?.trim().toLowerCase()

  const auth = await readSessionAuth()
  if (auth?.workspace) redirect("/calendar")

  if (!email) {
    return (
      <AuthCard className="space-y-6 text-center">
        <h1 className="text-xl font-medium text-foreground">Invalid link</h1>
        <p className="text-sm text-foreground/75">
          Open the link from your approval email, or sign in if you already created your account.
        </p>
        <Link href="/login" className="inline-flex">
          <Button variant="outline">Go to sign in</Button>
        </Link>
      </AuthCard>
    )
  }

  const invite = await getApprovedBetaInvite(email)
  if (!invite) {
    return (
      <AuthCard className="space-y-6 text-center">
        <h1 className="text-xl font-medium text-foreground">Access not ready</h1>
        <p className="text-sm text-foreground/75">
          We could not find an approved invite for <strong>{email}</strong>. Check the address or
          wait for your approval email.
        </p>
        <Link href="/login" className="inline-flex">
          <Button variant="outline">Go to sign in</Button>
        </Link>
      </AuthCard>
    )
  }

  return <ClaimAccessForm email={invite.email} name={invite.name} />
}

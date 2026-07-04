import { redirect } from "next/navigation"

import { PLAN_CHOICES, type PlanChoice } from "@/lib/schemas/signupRequest"

export const dynamic = "force-dynamic"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan } = await searchParams
  if (plan && PLAN_CHOICES.includes(plan as PlanChoice)) {
    redirect(`/request-invite?plan=${plan}`)
  }
  redirect("/request-invite")
}

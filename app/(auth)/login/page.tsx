import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Sign in",
}

export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your SAFE Foundation or Kataco Google account.
        </p>
      </header>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

"use client"

import { ShaderBackground } from "@/components/auth/shader-background"
import { TimblWordmark } from "@/components/brand/timbl-logo"

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-dark dark relative min-h-screen w-full overflow-hidden text-foreground">
      <ShaderBackground />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-black/25 to-black/45" />
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-center">
            <TimblWordmark logoSize={40} href="/" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

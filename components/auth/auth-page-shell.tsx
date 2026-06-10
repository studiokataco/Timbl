"use client"

import { ShaderBackground } from "@/components/auth/shader-background"

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative min-h-screen w-full overflow-hidden bg-surface-dark text-foreground">
      <ShaderBackground />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

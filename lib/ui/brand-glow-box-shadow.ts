export function brandGlowBoxShadow() {
  return (
    "0 0 0 1.5px color-mix(in oklab, var(--color-brand-accent, #3b82f6) 80%, transparent), " +
    "0 0 20px -2px color-mix(in oklab, var(--color-brand-accent, #3b82f6) calc(var(--ai-glow, 0) * 70%), transparent)"
  )
}

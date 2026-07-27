import { BrandGlowButton } from "timbl"

export function Default() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <BrandGlowButton>Ask AI</BrandGlowButton>
      <BrandGlowButton>Generate captions</BrandGlowButton>
    </div>
  )
}

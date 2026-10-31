const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

export type CheckoutOptions = {
  key: string
  subscription_id: string
  name: string
  description?: string
  prefill?: { email?: string; name?: string }
  theme?: { color?: string }
  handler?: (res: unknown) => void
  modal?: { ondismiss?: () => void }
}

type CheckoutInstance = {
  open: () => void
  on: (event: "payment.failed", cb: (res: { error?: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance
  }
}

export function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"))
    if (window.Razorpay) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("checkout failed to load")))
      return
    }
    const s = document.createElement("script")
    s.src = CHECKOUT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("checkout failed to load"))
    document.body.appendChild(s)
  })
}

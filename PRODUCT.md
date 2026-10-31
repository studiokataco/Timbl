# Timbl

AI social media planner for brands and agencies. Agents draft and schedule posts across Instagram, Facebook, LinkedIn and X; humans approve everything before it ships. Multi-tenant SaaS at timbl.app with a platform control centre at admin.timbl.app.

## Audience

- Solo creators and single-brand studios (Free, Studio tiers)
- Agencies managing multiple client brands (Agency, Scale tiers)
- Region-first: India (INR pricing, Razorpay billing)

## Register

- Marketing surfaces (landing, /pricing, auth pages): brand register - design is the pitch. Voice: confident, calm, engineered. Reference lane: Cal.com-style white-canvas SaaS with black CTAs (see DESIGN.md - the committed identity; do not re-derive).
- App + control centre: product register - design serves the workflow (calendar, kanban, composer, approvals).

## Product truths that shape design

- Invite-only for free use: Free/trial CTAs route to /request-invite. Paid tiers can be bought directly at /checkout (Google sign-in, then Razorpay); the workspace is created only when the webhook confirms payment, then the buyer walks the onboarding wizard.
- The plan is unlocked only by the Razorpay webhook - UI never promises a tier before payment confirms.
- Sentence case everywhere; ASCII hyphens only; sonner for toasts; lucide icons.
- Every page ships light and dark (class-driven .dark on html).

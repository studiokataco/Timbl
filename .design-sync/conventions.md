# Timbl design system - how to build with it

Timbl is a social-media planner. The visual language is Cal-style: a white canvas, a
near-black `ink` primary, one sparing blue accent, and a small pastel palette for status.
Components are React, styled with Tailwind v4 utility classes that map to CSS variables.

## Setup and wrapping
- No global provider is required - components read their tokens from CSS variables that are
  always in scope once `styles.css` is loaded. Import components from `window.Timbl` (the
  bundle assigns every export there).
- Two exceptions:
  - Wrap any `Tooltip` in a single `TooltipProvider` (usually once, near the app root).
  - Dark mode is opt-in: add the class `dark` to an ancestor element. Auth surfaces use
    `auth-dark` instead. There is no theme prop - it is purely the ancestor class.

## Styling idiom - Tailwind v4 utilities mapped to tokens
Style layout and one-off surfaces with these utility families (all defined in the shipped
CSS; use them, do not invent hex values):

- Surfaces: `bg-background` (canvas), `bg-card`, `bg-muted` (soft), `bg-secondary`,
  `bg-primary` (ink CTA), `bg-destructive`.
- Text: `text-foreground`, `text-muted-foreground`, `text-primary-foreground` (on ink),
  `text-card-foreground`.
- Lines: `border-border`, and the softer `border-hairline`.
- Radius: `rounded-lg` (controls/buttons), `rounded-xl` (cards), `rounded-4xl` and
  `rounded-full` (pills/badges).
- Status pastels (use for badges/dots, never as large fills): `bg-badge-orange`,
  `bg-badge-pink`, `bg-badge-violet`, `bg-badge-emerald`.
- Typography scale (utility classes, not props): `text-display-md` / `text-display-lg` for
  page titles, `text-title-lg` / `text-title-md` for section heads, `text-body-md` /
  `text-body-sm` for copy, `text-caption` for metadata. Negative tracking on the display
  sizes is the Cal signature - it is baked into these utilities.

Fonts: Inter (`--font-sans`) for everything, JetBrains Mono (`--font-mono`) for code.

## Where the truth lives
- `styles.css` (and its `@import` of `_ds_bundle.css`) is the full compiled stylesheet -
  read it for the exact token values and every available utility.
- Each component ships `components/<group>/<Name>/<Name>.prompt.md` (usage) and
  `<Name>.d.ts` (props). Read those before composing a component.

## One idiomatic snippet
```tsx
// A scheduled-post card, built from Timbl parts + the utility idiom for layout glue.
<Card>
  <CardHeader>
    <CardTitle>Spring launch teaser</CardTitle>
    <CardDescription>Instagram - carousel</CardDescription>
    <CardAction><Badge variant="secondary">Draft</Badge></CardAction>
  </CardHeader>
  <CardContent>
    <p className="text-body-sm text-muted-foreground">
      Behind-the-scenes of the new collection.
    </p>
  </CardContent>
  <CardFooter className="justify-between">
    <span className="text-caption text-muted-foreground">Scheduled Apr 12</span>
    <Button>Open</Button>
  </CardFooter>
</Card>
```

Compound components (Card, Dialog, Select, DropdownMenu, Sheet, Popover, Tabs) are composed
from their exported parts - always open the component's `.prompt.md` for the part list.

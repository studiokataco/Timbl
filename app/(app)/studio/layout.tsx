/*
 * Studio shell — flex column under the global TopBar (provided by the root
 * (app) layout). The three-column workspace itself (roster / pipeline /
 * inspector) is owned by `page.tsx` so the layout can later host nested
 * routes (e.g. /studio/agents/[name]) without re-rendering the rails.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {children}
    </div>
  )
}

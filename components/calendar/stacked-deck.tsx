"use client"

import { useState, useRef, useLayoutEffect } from "react"

export function StackedDeck({
  cards,
  slotHeight,
  onClick,
}: {
  cards: React.ReactNode[]
  slotHeight: number
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [cardHeights, setCardHeights] = useState<number[]>([])
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const n = cards.length
  const PEEK = 6
  const GAP = 8
  const ANIM_MS = 280

  useLayoutEffect(() => {
    const heights = cardRefs.current.map((el) => el?.offsetHeight ?? slotHeight)
    setCardHeights(heights)
  }, [n, slotHeight])

  const expandedOffsets = cardHeights.reduce<number[]>((acc, _h, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (cardHeights[i - 1] ?? slotHeight) + GAP)
    return acc
  }, [])

  const topCardHeight = cardHeights[0] ?? slotHeight
  const totalExpandedHeight =
    n > 0
      ? (expandedOffsets[n - 1] ?? 0) + (cardHeights[n - 1] ?? slotHeight)
      : n * slotHeight

  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    setCollapsing(false)
    setHovered(true)
  }

  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setHovered(false)
      setCollapsing(true)
      collapseTimer.current = setTimeout(() => setCollapsing(false), ANIM_MS + 20)
    }, 100)
  }

  return (
    <div
      className="relative cursor-pointer"
      style={{
        height: hovered
          ? totalExpandedHeight
          : topCardHeight + (n - 1) * PEEK,
        transition: `height ${ANIM_MS}ms ease-out`,
        marginBottom: 8,
        pointerEvents: collapsing ? "none" : "auto",
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          ref={(el) => { cardRefs.current[i] = el }}
          style={{
            position: "absolute",
            left: `${i * 2}px`,
            right: `${i * 2}px`,
            top: 0,
            zIndex: n - i,
            transform: hovered
              ? `translateY(${expandedOffsets[i] ?? i * slotHeight}px)`
              : `translateY(${i * PEEK}px)`,
            transition: `transform ${ANIM_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 30}ms, opacity 200ms ease`,
            opacity: hovered ? 1 : i === 0 ? 1 : 0.5,
          }}
        >
          {card}
        </div>
      ))}
    </div>
  )
}

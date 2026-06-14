"use client"

import { useState } from "react"

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
  const n = cards.length
  const PEEK = 6

  return (
    <div
      className="relative cursor-pointer"
      style={{
        height: hovered ? n * slotHeight : slotHeight + (n - 1) * PEEK,
        transition: "height 280ms ease-out",
        marginBottom: 8,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${i * 2}px`,
            right: `${i * 2}px`,
            top: 0,
            zIndex: n - i,
            transform: hovered
              ? `translateY(${i * slotHeight}px)`
              : `translateY(${i * PEEK}px)`,
            transition: `transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 30}ms, opacity 200ms ease`,
            opacity: hovered ? 1 : i === 0 ? 1 : 0.5,
          }}
        >
          {card}
        </div>
      ))}
    </div>
  )
}

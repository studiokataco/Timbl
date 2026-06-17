"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

const WORD_COLORS = [
  "#fb923c",
  "#10b981",
  "#ec4899",
  "#34d399",
  "#f59e0b",
] as const

type TypewriterWordProps = {
  words: string[]
  typingSpeed?: number
  deleteSpeed?: number
  pauseBeforeDelete?: number
  startDelay?: number
  naturalVariance?: boolean
}

export function TypewriterWord({
  words,
  typingSpeed = 90,
  deleteSpeed = 45,
  pauseBeforeDelete = 1600,
  startDelay = 400,
  naturalVariance = true,
}: TypewriterWordProps) {
  const [displayText, setDisplayText] = useState(words[0] ?? "")
  const [wordIndex, setWordIndex] = useState(0)
  const wordIndexRef = useRef(0)
  const charIndexRef = useRef(words[0]?.length ?? 0)
  const isDeletingRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wordsRef = useRef(words)
  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    const getTypingDelay = () => {
      if (!naturalVariance) return typingSpeed
      const random = Math.random()
      if (random < 0.1) return typingSpeed * 2
      if (random > 0.9) return typingSpeed * 0.5
      const variance = 0.4
      const min = typingSpeed * (1 - variance)
      const max = typingSpeed * (1 + variance)
      return Math.random() * (max - min) + min
    }

    const run = () => {
      const current = wordsRef.current[wordIndexRef.current] ?? ""

      if (isDeletingRef.current) {
        if (charIndexRef.current > 0) {
          charIndexRef.current -= 1
          setDisplayText(current.slice(0, charIndexRef.current))
          timeoutRef.current = setTimeout(run, deleteSpeed)
        } else {
          isDeletingRef.current = false
          wordIndexRef.current = (wordIndexRef.current + 1) % wordsRef.current.length
          setWordIndex(wordIndexRef.current)
          timeoutRef.current = setTimeout(run, 120)
        }
      } else if (charIndexRef.current < current.length) {
        charIndexRef.current += 1
        setDisplayText(current.slice(0, charIndexRef.current))
        timeoutRef.current = setTimeout(run, getTypingDelay())
      } else {
        timeoutRef.current = setTimeout(() => {
          isDeletingRef.current = true
          run()
        }, pauseBeforeDelete)
      }
    }

    timeoutRef.current = setTimeout(run, startDelay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [typingSpeed, deleteSpeed, pauseBeforeDelete, startDelay, naturalVariance])

  return (
    <span
      className="inline-flex items-baseline whitespace-nowrap transition-colors duration-300"
      style={{ color: WORD_COLORS[wordIndex % WORD_COLORS.length] }}
    >
      <span>{displayText}</span>
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatType: "loop", ease: "linear" }}
        className="ms-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.08em] bg-current"
      />
    </span>
  )
}

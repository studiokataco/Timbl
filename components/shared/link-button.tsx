"use client"

import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"

type ButtonProps = ComponentProps<typeof Button>

type Props = Omit<ButtonProps, "render" | "nativeButton"> & {
  href: string
  children: ReactNode
}

export function LinkButton({ href, children, ...buttonProps }: Props) {
  return (
    <Button
      {...buttonProps}
      nativeButton={false}
      render={(props) => <Link href={href} {...props} />}
    >
      {children}
    </Button>
  )
}

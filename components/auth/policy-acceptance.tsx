"use client"

import Link from "next/link"

import { Checkbox } from "@/components/ui/checkbox"

export function PolicyAcceptance({
  id = "accept_terms",
  checked,
  onCheckedChange,
  error,
}: {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={Boolean(error)}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-foreground/75">
          I have read and agree to Timbl&apos;s{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            Terms and conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            Privacy policy
          </Link>
          .
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

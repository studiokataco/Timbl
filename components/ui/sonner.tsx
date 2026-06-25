"use client"

import { useTheme } from "@/components/shared/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          closeButton:
            "!bg-popover !text-muted-foreground !border-border hover:!text-foreground hover:!bg-secondary",
          cancelButton:
            "cn-toast-cancel !h-8 !rounded-md !px-3 !text-sm !font-semibold !bg-secondary !text-secondary-foreground !border !border-border hover:!bg-secondary/80",
          actionButton:
            "cn-toast-action !h-8 !rounded-md !px-3 !text-sm !font-semibold !bg-primary !text-primary-foreground hover:!bg-primary/90 !border-0",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

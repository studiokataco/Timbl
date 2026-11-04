import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-xl",
        "text-display-lg",
        "text-display-md",
        "text-display-sm",
        "text-title-lg",
        "text-title-md",
        "text-title-sm",
        "text-body-md",
        "text-body-sm",
        "text-caption",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

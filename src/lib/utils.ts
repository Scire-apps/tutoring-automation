import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge Tailwind class names, resolving conflicts. Used by the shadcn-style ui/* primitives. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

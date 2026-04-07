/**
 * Utility functions for frontend styling and class name handling.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges and combines multiple class values while resolving Tailwind CSS conflicts.
 *
 * This function chains `clsx` for conditional class composition with `twMerge`
 * to intelligently merge Tailwind classes, preventing conflicts when the same
 * property is defined in multiple classes.
 *
 * @param inputs - One or more class values (strings, objects, or arrays)
 * @returns A merged class string with conflicting Tailwind utilities resolved
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4")
 * // Returns: "py-1 bg-blue-500 px-4" (px-4 overrides px-2)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

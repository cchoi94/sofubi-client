import { clsx, type ClassValue } from "clsx";

/**
 * Utility for conditional class names using clsx.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

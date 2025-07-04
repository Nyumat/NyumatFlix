import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class Logger {
  constructor(private readonly name: string) {}

  info(message: string, data?: unknown) {
    console.log(`[${this.name}] ${message}`, data);
  }

  error(message: string, data?: unknown) {
    console.error(`[${this.name}] ${message}`, data);
  }

  warn(message: string, data?: unknown) {
    console.warn(`[${this.name}] ${message}`, data);
  }
}

export const logger = new Logger("Nyumatflix 3.0");

export const isBrowser = typeof window !== "undefined";

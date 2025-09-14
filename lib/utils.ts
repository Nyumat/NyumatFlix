import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LOGGER_TITLE, requiredEnvVars } from "./constants";

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

export function validateEnv() {
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
}

export const logger = new Logger(LOGGER_TITLE);

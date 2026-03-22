import { availableParams } from "@/config/site";
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

export const getCountryName = (regionCode: string): string => {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(
      regionCode.toUpperCase(),
    );
    return name ?? regionCode;
  } catch {
    return regionCode;
  }
};

export function getRandomItems<T>(array: T[], count = 1): T[] {
  if (array.length === 0 || count <= 0) {
    return [];
  }
  const maxStartIndex = Math.max(0, array.length - count);
  const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
  return array.slice(startIndex, startIndex + count);
}

export function formatValue<T>(
  value: T | null | undefined,
  formatter?: (input: T) => string | number,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (formatter) {
    return String(formatter(value as T));
  }
  return String(value);
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function filterDiscoverParams(
  params?: Record<string, string>,
): Record<string, string> {
  const allowed = new Set<string>(availableParams);
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(([key]) => allowed.has(key)),
  );
}

export function normalizeRouteSearchParams(
  input: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v === undefined || v === "") continue;
    out[key] = v;
  }
  return out;
}

export function joiner<T extends Record<string, unknown>>(
  items: (T | undefined)[],
  key: keyof T & string,
): string {
  return items
    .filter((x): x is T => x != null)
    .map((item) => String(item[key]))
    .join(", ");
}

export function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getUniqueItems<T extends { id: number }>(list: T[]): T[] {
  const unique = new Map(list.map((item) => [item.id, item]));
  return Array.from(unique.values());
}

export const isDeceasedAsOfToday = (
  deathday: string | null | undefined,
): boolean => {
  if (deathday == null || String(deathday).trim() === "") return false;
  const parts = deathday.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [y, m, d] = parts;
  const death = new Date(y, m - 1, d);
  death.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return death <= today;
};

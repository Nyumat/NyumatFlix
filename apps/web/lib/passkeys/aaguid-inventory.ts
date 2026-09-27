import aaguidNames from "@/data/passkeys/aaguid-names.json";

const inventory = aaguidNames as Record<string, string>;

export function normalizeAaguid(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (/^[0-9a-f]{32}$/.test(trimmed)) {
    return `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(12, 16)}-${trimmed.slice(16, 20)}-${trimmed.slice(20)}`;
  }
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      trimmed,
    )
  ) {
    return trimmed;
  }
  return null;
}

export function lookupAaguidName(
  aaguid: string | null | undefined,
): string | null {
  const normalized = normalizeAaguid(aaguid);
  if (!normalized) return null;
  return inventory[normalized] ?? null;
}

export function listKnownAaguids(): Array<{ aaguid: string; name: string }> {
  return Object.entries(inventory)
    .map(([aaguid, name]) => ({ aaguid, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

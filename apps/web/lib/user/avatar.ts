export const AVATAR_VARIANTS = [
  "beam",
  "pixel",
  "marble",
  "sunset",
  "ring",
  "bauhaus",
  "geometric",
  "abstract",
] as const;

export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

export const AVATAR_VARIANT_LABELS: Record<AvatarVariant, string> = {
  beam: "Beam",
  pixel: "Pixel",
  marble: "Marble",
  sunset: "Sunset",
  ring: "Ring",
  bauhaus: "Bauhaus",
  geometric: "Geo",
  abstract: "Abstract",
};

export const AVATAR_PRESETS = [
  "nebula",
  "vortex",
  "eclipse",
  "onyx",
  "ember",
  "prism",
  "cipher",
  "phantom",
  "apex",
  "nova",
  "flux",
  "drift",
  "spark",
  "pulse",
  "ghost",
  "matrix",
  "zenith",
  "orbit",
  "aurora",
  "cobalt",
  "crimson",
  "slate",
  "ivory",
  "jade",
  "blake",
  "cascade",
  "denver",
  "flora",
  "grove",
  "harbor",
  "kite",
  "lumen",
  "moss",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const DEFAULT_AVATAR_ACCENT = "A12E9B";

export const AVATAR_ACCENT_PRESETS = [
  { hex: "A12E9B", label: "Orchid" },
  { hex: "E50914", label: "Crimson" },
  { hex: "458588", label: "Teal" },
  { hex: "8B5CF6", label: "Violet" },
  { hex: "F97316", label: "Ember" },
  { hex: "64748B", label: "Slate" },
] as const;

export type ParsedAvatarToken =
  | {
      type: "boring";
      variant: AvatarVariant;
      seed: AvatarPreset;
      accent: string;
    }
  | { type: "dicebear"; seed: AvatarPreset };

const BORING_TOKEN_PREFIX = "boring:";
const LEGACY_DICEBEAR_PREFIX = "dicebear:";

const AVATAR_SURFACE = "#221F1F";
const AVATAR_MUTED = "#564d4d";
const AVATAR_HIGHLIGHT = "#F5F5F1";

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function normalizeAccentHex(value: string): string | null {
  const cleaned = value.trim().replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeAccentHex(hex);
  if (!normalized) {
    return [161, 46, 155];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function mixHex(hex: string, targetHex: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(targetHex);
  return rgbToHex(
    r1 + (r2 - r1) * weight,
    g1 + (g2 - g1) * weight,
    b1 + (b2 - b1) * weight,
  );
}

function withHash(hex: string): string {
  return `#${normalizeAccentHex(hex) ?? DEFAULT_AVATAR_ACCENT}`;
}

function accentShades(accent: string) {
  const normalized = normalizeAccentHex(accent) ?? DEFAULT_AVATAR_ACCENT;
  return {
    accent: withHash(normalized),
    dark: withHash(mixHex(normalized, "221F1F", 0.42)),
    light: withHash(mixHex(normalized, "F5F5F1", 0.32)),
  };
}

export function getAvatarColors(
  variant: AvatarVariant,
  accent = DEFAULT_AVATAR_ACCENT,
): string[] {
  const { accent: primary, dark, light } = accentShades(accent);

  switch (variant) {
    case "pixel":
      return [primary, dark, light, AVATAR_SURFACE, AVATAR_MUTED];
    case "marble":
      return [dark, AVATAR_MUTED, AVATAR_SURFACE, primary, light];
    case "sunset":
      return [primary, dark, light, AVATAR_SURFACE, AVATAR_MUTED];
    case "ring":
      return [primary, dark, AVATAR_SURFACE, AVATAR_MUTED, AVATAR_HIGHLIGHT];
    case "bauhaus":
      return [primary, light, dark, AVATAR_SURFACE, AVATAR_MUTED];
    case "geometric":
      return [primary, dark, AVATAR_SURFACE, light, AVATAR_MUTED];
    case "abstract":
      return [dark, primary, AVATAR_SURFACE, light, AVATAR_HIGHLIGHT];
    case "beam":
    default:
      return [primary, dark, AVATAR_MUTED, AVATAR_SURFACE, AVATAR_HIGHLIGHT];
  }
}

export function encodeAvatarToken(
  variant: AvatarVariant,
  seed: AvatarPreset,
  accent = DEFAULT_AVATAR_ACCENT,
): string {
  const normalizedAccent = normalizeAccentHex(accent) ?? DEFAULT_AVATAR_ACCENT;
  return `${BORING_TOKEN_PREFIX}${variant}:${seed}:${normalizedAccent}`;
}

function isAvatarPreset(value: string): value is AvatarPreset {
  return AVATAR_PRESETS.includes(value as AvatarPreset);
}

function isAvatarVariant(value: string): value is AvatarVariant {
  return AVATAR_VARIANTS.includes(value as AvatarVariant);
}

export function parseAvatarToken(
  image: string | null | undefined,
): ParsedAvatarToken | null {
  if (!image) {
    return null;
  }

  if (image.startsWith(BORING_TOKEN_PREFIX)) {
    const parts = image.slice(BORING_TOKEN_PREFIX.length).split(":");
    if (parts.length < 2) {
      return null;
    }

    const [variant, seed, accentPart] = parts;
    if (
      !variant ||
      !seed ||
      !isAvatarVariant(variant) ||
      !isAvatarPreset(seed)
    ) {
      return null;
    }

    const accent = accentPart
      ? normalizeAccentHex(accentPart)
      : DEFAULT_AVATAR_ACCENT;
    if (accentPart && !accent) {
      return null;
    }

    return {
      type: "boring",
      variant,
      seed,
      accent: accent ?? DEFAULT_AVATAR_ACCENT,
    };
  }

  if (image.startsWith(LEGACY_DICEBEAR_PREFIX)) {
    const parts = image.split(":");
    const seed = parts[2];
    if (!seed || !isAvatarPreset(seed)) {
      return null;
    }

    return { type: "dicebear", seed };
  }

  return null;
}

export function isAllowedAvatar(image: string): boolean {
  return parseAvatarToken(image) !== null;
}

export function resolveAvatarSelection(image: string | null | undefined): {
  variant: AvatarVariant;
  seed: AvatarPreset;
  accent: string;
} {
  const parsed = parseAvatarToken(image);
  if (parsed?.type === "boring") {
    return {
      variant: parsed.variant,
      seed: parsed.seed,
      accent: parsed.accent,
    };
  }

  if (parsed?.type === "dicebear") {
    return {
      variant: "beam",
      seed: parsed.seed,
      accent: DEFAULT_AVATAR_ACCENT,
    };
  }

  return {
    variant: "beam",
    seed: AVATAR_PRESETS[0],
    accent: DEFAULT_AVATAR_ACCENT,
  };
}

export function randomAvatarSelection(): {
  variant: AvatarVariant;
  seed: AvatarPreset;
  accent: string;
} {
  const variant =
    AVATAR_VARIANTS[Math.floor(Math.random() * AVATAR_VARIANTS.length)] ??
    "beam";
  const seed =
    AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)] ??
    AVATAR_PRESETS[0];
  const accentPreset =
    AVATAR_ACCENT_PRESETS[
      Math.floor(Math.random() * AVATAR_ACCENT_PRESETS.length)
    ] ?? AVATAR_ACCENT_PRESETS[0];

  return { variant, seed, accent: accentPreset.hex };
}

export const ANNOUNCEMENT_ICON_NAMES = [
  "Bell",
  "Film",
  "Info",
  "Megaphone",
  "PartyPopper",
  "Sparkles",
  "TriangleAlert",
] as const;

export type AnnouncementIconName = (typeof ANNOUNCEMENT_ICON_NAMES)[number];

export type AnnouncementBannerConfig = {
  id: string;
  title: string;
  message: string;
  /** Empty string hides the icon on the live banner. */
  icon: AnnouncementIconName | "";
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  linkLabel: string;
  linkUrl: string;
  dismissible: boolean;
};

export const DEFAULT_ANNOUNCEMENT_BANNER_CONFIG: AnnouncementBannerConfig = {
  id: "announcement-1",
  title: "",
  message: "",
  icon: "Megaphone",
  backgroundColor: "#09090b",
  textColor: "#f4f4f5",
  accentColor: "#ffffff",
  linkLabel: "",
  linkUrl: "",
  dismissible: true,
};

const HEX_COLOR = /^#[\da-f]{6}$/i;
const BANNER_ID = /^[\w-]{1,64}$/;

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function linkUrl(value: unknown): string {
  const candidate = text(value, 500);
  if (!candidate) return "";
  if (candidate.startsWith("/") && !candidate.startsWith("//"))
    return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function sanitizeAnnouncementBannerConfig(
  value: unknown,
): AnnouncementBannerConfig {
  const raw = value && typeof value === "object" ? value : {};
  const config = raw as Partial<
    Record<keyof AnnouncementBannerConfig, unknown>
  >;
  const iconCandidate =
    typeof config.icon === "string" ? config.icon.trim() : "";
  const icon: AnnouncementBannerConfig["icon"] =
    iconCandidate === ""
      ? ""
      : ANNOUNCEMENT_ICON_NAMES.includes(iconCandidate as AnnouncementIconName)
        ? (iconCandidate as AnnouncementIconName)
        : DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.icon;
  const id = text(config.id, 64);

  return {
    id: BANNER_ID.test(id) ? id : DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.id,
    title: text(config.title, 100),
    message: text(config.message, 280),
    icon,
    backgroundColor: color(
      config.backgroundColor,
      DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.backgroundColor,
    ),
    textColor: color(
      config.textColor,
      DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.textColor,
    ),
    accentColor: color(
      config.accentColor,
      DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.accentColor,
    ),
    linkLabel: text(config.linkLabel, 40),
    linkUrl: linkUrl(config.linkUrl),
    dismissible:
      typeof config.dismissible === "boolean"
        ? config.dismissible
        : DEFAULT_ANNOUNCEMENT_BANNER_CONFIG.dismissible,
  };
}

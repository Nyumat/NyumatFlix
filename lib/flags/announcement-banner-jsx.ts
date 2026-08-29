import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  sanitizeAnnouncementBannerConfig,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";

const STRING_PROPS = [
  "id",
  "title",
  "message",
  "icon",
  "backgroundColor",
  "textColor",
  "accentColor",
  "linkLabel",
  "linkUrl",
] as const;

const ALLOWED_PROPS = new Set<string>([...STRING_PROPS, "dismissible"]);

export function announcementBannerConfigToJsx(
  config: AnnouncementBannerConfig,
): string {
  const stringProps = STRING_PROPS.map(
    (key) => `  ${key}=${JSON.stringify(config[key])}`,
  );

  return [
    "<AnnouncementBanner",
    ...stringProps,
    `  dismissible={${config.dismissible}}`,
    "/>",
  ].join("\n");
}

export type AnnouncementBannerJsxResult =
  | { config: AnnouncementBannerConfig; error: null }
  | { config: null; error: string };

export function parseAnnouncementBannerJsx(
  source: string,
): AnnouncementBannerJsxResult {
  const match = source.trim().match(/^<AnnouncementBanner\s+([\s\S]*?)\s*\/>$/);
  if (!match) {
    return {
      config: null,
      error: "Use one self-closing <AnnouncementBanner … /> component.",
    };
  }

  const body = match[1] ?? "";
  const attributePattern =
    /([A-Za-z][A-Za-z0-9]*)\s*=\s*("(?:\\.|[^"\\])*"|\{(?:true|false)\})/g;
  const values: Record<string, unknown> = {};
  let cursor = 0;

  for (const attribute of body.matchAll(attributePattern)) {
    const index = attribute.index ?? 0;
    if (body.slice(cursor, index).trim()) {
      return { config: null, error: "The JSX contains unsupported syntax." };
    }

    const key = attribute[1] ?? "";
    const rawValue = attribute[2] ?? "";
    if (!ALLOWED_PROPS.has(key)) {
      return { config: null, error: `Unknown prop: ${key}` };
    }
    if (key in values) {
      return { config: null, error: `Duplicate prop: ${key}` };
    }

    try {
      values[key] = rawValue.startsWith("{")
        ? rawValue === "{true}"
        : JSON.parse(rawValue);
    } catch {
      return { config: null, error: `Invalid value for ${key}` };
    }
    cursor = index + attribute[0].length;
  }

  if (body.slice(cursor).trim()) {
    return { config: null, error: "The JSX contains unsupported syntax." };
  }

  const candidate = {
    ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
    ...values,
  };
  const config = sanitizeAnnouncementBannerConfig(candidate);

  for (const key of Object.keys(values)) {
    if (config[key as keyof AnnouncementBannerConfig] !== values[key]) {
      return { config: null, error: `Invalid value for ${key}` };
    }
  }

  return { config, error: null };
}

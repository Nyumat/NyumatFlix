import { LogoSchema, type Logo } from "@/lib/domain/typings";

export const CAROUSEL_LOGO_ENRICH_COUNT = 20;

export const pickEnglishLogo = (logos: unknown): Logo | undefined => {
  if (!Array.isArray(logos) || logos.length === 0) {
    return undefined;
  }

  const selected =
    logos.find((logo) => {
      return (
        typeof logo === "object" &&
        logo !== null &&
        "iso_639_1" in logo &&
        logo.iso_639_1 === "en"
      );
    }) ?? logos[0];

  const result = LogoSchema.safeParse(selected);
  return result.success ? result.data : undefined;
};

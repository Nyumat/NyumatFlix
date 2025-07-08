/**
 * Mapping for user-friendly country names
 * Maps ISO 3166-1 alpha-2 country codes to user-friendly display names
 */
export const FRIENDLY_COUNTRY_NAMES: Record<string, string> = {
  KR: "South Korea",
  KP: "North Korea",
  US: "United States",
  GB: "United Kingdom",
  CN: "China",
  JP: "Japan",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  BR: "Brazil",
  IN: "India",
  RU: "Russia",
  CA: "Canada",
  AU: "Australia",
  MX: "Mexico",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  VE: "Venezuela",
  ZA: "South Africa",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  MA: "Morocco",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  TR: "Turkey",
  IL: "Israel",
  AE: "UAE",
  SA: "Saudi Arabia",
  IR: "Iran",
  IQ: "Iraq",
  SY: "Syria",
  JO: "Jordan",
  LB: "Lebanon",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IS: "Iceland",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  CZ: "Czech Republic",
  PL: "Poland",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  RS: "Serbia",
  BA: "Bosnia and Herzegovina",
  GR: "Greece",
  PT: "Portugal",
  IE: "Ireland",
  NZ: "New Zealand",
};

/**
 * Gets a user-friendly country name from a country code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "KR", "US")
 * @param fallbackName - Fallback name to use if no friendly name is available
 * @returns User-friendly country name
 */
export function getFriendlyCountryName(
  countryCode: string,
  fallbackName?: string,
): string {
  const code = countryCode.toUpperCase();
  return FRIENDLY_COUNTRY_NAMES[code] || fallbackName || code;
}

/**
 * Checks if a country code has a friendly name mapping
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns True if a friendly name mapping exists
 */
export function hasFriendlyCountryName(countryCode: string): boolean {
  return countryCode.toUpperCase() in FRIENDLY_COUNTRY_NAMES;
}

/**
 * This function gets the primary country code from a list of country codes.
 * @param countryCodes - Array of ISO 3166-1 alpha-2 country codes
 * @returns The first valid country code, or undefined if none found
 */
export function getPrimaryCountry(countryCodes?: string[]): string | undefined {
  if (!countryCodes || countryCodes.length === 0) {
    return undefined;
  }

  // I'll just return the first valid country code.
  return countryCodes.find((code) => code && code.length === 2);
}

/**
 * This converts a country code to its corresponding flag emoji.
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
 * @returns Flag emoji string or null if invalid
 */
export function getCountryFlagEmoji(countryCode: string): string | null {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  const code = countryCode.toUpperCase();

  // I convert the country code to regional indicator symbols.
  // Each letter is converted to its regional indicator equivalent,
  // where A-Z maps to U+1F1E6 to U+1F1FF (🇦-🇿).
  const firstChar = code.charCodeAt(0) - 65 + 0x1f1e6;
  const secondChar = code.charCodeAt(1) - 65 + 0x1f1e6;

  // Need to check if the characters are valid before creating the emoji.
  if (
    firstChar < 0x1f1e6 ||
    firstChar > 0x1f1ff ||
    secondChar < 0x1f1e6 ||
    secondChar > 0x1f1ff
  ) {
    return null;
  }

  return String.fromCodePoint(firstChar, secondChar);
}

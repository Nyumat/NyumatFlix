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

export function getFriendlyCountryName(
  countryCode: string,
  fallbackName?: string,
): string {
  const code = countryCode.toUpperCase();
  return FRIENDLY_COUNTRY_NAMES[code] || fallbackName || code;
}

export function hasFriendlyCountryName(countryCode: string): boolean {
  return countryCode.toUpperCase() in FRIENDLY_COUNTRY_NAMES;
}

export function getPrimaryCountry(countryCodes?: string[]): string | undefined {
  if (!countryCodes || countryCodes.length === 0) {
    return undefined;
  }

  return countryCodes.find((code) => code && code.length === 2);
}

export function getCountryFlagEmoji(countryCode: string): string | null {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  const code = countryCode.toUpperCase();

  const firstChar = code.charCodeAt(0) - 65 + 0x1f1e6;
  const secondChar = code.charCodeAt(1) - 65 + 0x1f1e6;

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

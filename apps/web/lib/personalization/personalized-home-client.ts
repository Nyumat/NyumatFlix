import type { PersonalizedHomeData } from "@/lib/personalization/personalized-home-types";
import {
  parsePersonalizedHomeResponse,
  type PersonalizedHomeResponseWire,
} from "@/lib/personalization/personalized-home-types";

export type {
  PersonalizedHomeData,
  PersonalizedUpNextItem,
} from "@/lib/personalization/personalized-home-types";

export { parsePersonalizedHomeResponse };

export async function fetchPersonalizedHome(): Promise<PersonalizedHomeData> {
  const response = await fetch("/api/home/personalized");

  if (response.status === 401) {
    return {
      recentlyWatched: [],
      upNext: [],
      becauseYouWatched: null,
    };
  }

  if (!response.ok) {
    throw new Error("Failed to fetch personalized home");
  }

  const wire = (await response.json()) as PersonalizedHomeResponseWire;
  return parsePersonalizedHomeResponse(wire);
}

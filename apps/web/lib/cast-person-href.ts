import { isRemoteImagePath } from "@/lib/media-poster-path";

export const resolveCastPersonHref = (person: {
  id: number;
  href?: string | null;
  profile_path?: string | null;
}): string | null => {
  if (person.href === null) {
    return null;
  }

  if (typeof person.href === "string" && person.href.trim().length > 0) {
    return person.href;
  }

  if (isRemoteImagePath(person.profile_path)) {
    return null;
  }

  return `/person/${person.id}`;
};

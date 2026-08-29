import type { JWT } from "next-auth/jwt";

export type AuthUserLike = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type AuthSessionUpdateLike = {
  name?: string;
  image?: string;
};

export type AuthDbProfile = {
  name: string | null;
  email: string | null;
  image: string | null;
};

export function applyAuthUserToJwt(token: JWT, user: AuthUserLike): JWT {
  const next: JWT = {
    ...token,
    profileHydrated: true,
  };

  if (typeof user.id === "string") {
    next.uid = user.id;
  }
  if (typeof user.name === "string") {
    next.name = user.name;
  }
  if (typeof user.email === "string") {
    next.email = user.email;
  }
  if (typeof user.image === "string") {
    next.picture = user.image;
  }

  return next;
}

export function applyAuthSessionUpdateToJwt(
  token: JWT,
  session: AuthSessionUpdateLike,
): JWT {
  const next: JWT = { ...token };
  if (typeof session.name === "string") {
    next.name = session.name;
  }
  if (typeof session.image === "string") {
    next.picture = session.image;
  }
  return next;
}

export function applyAuthDbProfileToJwt(
  token: JWT,
  dbUser: AuthDbProfile,
): JWT {
  const next: JWT = {
    ...token,
    name: dbUser.name ?? undefined,
    picture: dbUser.image ?? undefined,
    profileHydrated: true,
  };
  if (dbUser.email) {
    next.email = dbUser.email;
  }
  return next;
}

export function shouldRefreshAuthJwtFromDatabase(
  token: Pick<JWT, "uid" | "profileHydrated">,
  trigger?: string,
): boolean {
  if (typeof token.uid !== "string") {
    return false;
  }
  if (trigger === "update") {
    return true;
  }
  return token.profileHydrated !== true;
}

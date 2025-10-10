"use server";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { NavbarClient } from "./navbar-client";

export const NavbarServer = async () => {
  const session = await auth();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  return <NavbarClient session={session} pathname={pathname} />;
};

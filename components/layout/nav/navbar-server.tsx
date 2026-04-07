"use server";

import { auth } from "@/auth";
import { NavbarClient } from "./navbar-client";

export const NavbarServer = async () => {
  const session = await auth();
  return <NavbarClient session={session} />;
};

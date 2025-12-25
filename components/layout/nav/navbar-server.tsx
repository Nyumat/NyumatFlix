"use server";

import { auth } from "@/auth";
import { NavbarClient } from "./navbar-client";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const NavbarServer = async () => {
  const session = await auth();
  return (
    <>
      <NavbarClient session={session} />
    </>
  );
};

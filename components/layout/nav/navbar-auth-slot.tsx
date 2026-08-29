"use client";

import { NavbarAuth } from "@/components/layout/nav/navbar-auth";
import { resolveAuthSession } from "@/lib/auth/session-state";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { navbarActionButtonClassName } from "./navbar-action-button";

type NavbarAuthSlotProps = {
  session?: Session | null;
  isMobile?: boolean;
  onMobileLinkClick?: () => void;
  triggerClassName?: string;
};

export const NavbarAuthSlot = ({
  session: sessionOverride,
  isMobile = false,
  onMobileLinkClick,
  triggerClassName,
}: NavbarAuthSlotProps) => {
  const { data: sessionData, status } = useSession();
  const session = resolveAuthSession(sessionData, status, sessionOverride);

  if (status === "loading" && !session) {
    return (
      <div
        className={cn(
          navbarActionButtonClassName,
          "inline-flex size-9 shrink-0 animate-pulse rounded-md bg-muted/40",
          triggerClassName,
        )}
        aria-hidden
      />
    );
  }

  return (
    <NavbarAuth
      session={session}
      isMobile={isMobile}
      onMobileLinkClick={onMobileLinkClick}
    />
  );
};

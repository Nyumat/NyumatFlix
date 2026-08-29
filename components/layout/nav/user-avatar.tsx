"use client";

import { History, List, LogOut, Settings } from "lucide-react";
import { Session } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveAuthSession } from "@/lib/auth/session-state";
import { cn } from "@/lib/utils";
import { navbarActionButtonClassName } from "./navbar-action-button";

interface UserAvatarProps {
  session: Session;
  triggerClassName?: string;
}

const userMenuItemClassName =
  "cursor-pointer rounded-none px-3 py-2 focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

export const UserAvatar = ({ session, triggerClassName }: UserAvatarProps) => {
  const { data: clientSession, status } = useSession();
  const activeSession = resolveAuthSession(clientSession, status, session);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (!activeSession) {
    return null;
  }

  const userEmail = activeSession.user?.email || "";
  const userName = activeSession.user?.name;
  const userImage = activeSession.user?.image;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="user-avatar-menu-trigger"
          variant="ghost"
          size="icon"
          type="button"
          className={cn(
            navbarActionButtonClassName,
            triggerClassName,
            "cursor-pointer focus-visible:outline-hidden focus-visible:ring-2",
            "data-[state=open]:border-white/25 data-[state=open]:bg-white/10 data-[state=open]:text-white data-[state=open]:ring-white/20",
          )}
        >
          <ProfileAvatar
            image={userImage}
            name={userName}
            email={userEmail}
            size={36}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 overflow-hidden p-0"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="px-3 py-2.5 font-normal">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col space-y-1">
              {userName && (
                <p className="truncate text-sm font-medium leading-none">
                  {userName}
                </p>
              )}
              <p className="truncate text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            </div>
            <Button
              aria-label="Sign out"
              className="-mr-2 -mt-2 h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
              size="icon"
              type="button"
              variant="ghost"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className={userMenuItemClassName}>
          <Link
            href="/watchlist"
            className="flex w-full cursor-pointer items-center"
          >
            <List className="mr-2 h-4 w-4" />
            <span>Watchlist</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={userMenuItemClassName}>
          <Link
            href="/history"
            className="flex w-full cursor-pointer items-center"
          >
            <History className="mr-2 h-4 w-4" />
            <span>Watch history</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className={cn(userMenuItemClassName, "rounded-b-md")}
        >
          <Link
            href="/settings"
            className="flex w-full cursor-pointer items-center"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

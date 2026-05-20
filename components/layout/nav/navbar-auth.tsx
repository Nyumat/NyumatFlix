import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { Session } from "next-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "./navbar-action-button";
import { UserAvatar } from "./user-avatar";

interface NavbarAuthProps {
  session: Session | null;
  isMobile?: boolean;
  onMobileLinkClick?: () => void;
}

export const NavbarAuth = ({
  session,
  isMobile = false,
  onMobileLinkClick,
}: NavbarAuthProps) => {
  if (isMobile) {
    return (
      <>
        {session ? (
          <UserAvatar session={session} />
        ) : (
          <Link
            href="/login"
            className="block px-3 py-3 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200"
            onClick={onMobileLinkClick}
          >
            <LogIn className="inline mr-2 h-4 w-4" />
            Sign In
          </Link>
        )}
      </>
    );
  }

  return (
    <>
      {session ? (
        <UserAvatar session={session} />
      ) : (
        <Link href="/login" aria-label="Sign in">
          <Button
            variant="ghost"
            size="icon"
            className={cn(navbarActionButtonClassName, "hidden md:inline-flex")}
          >
            <UserRound
              className={navbarActionIconClassName}
              strokeWidth={1.75}
            />
          </Button>
        </Link>
      )}
    </>
  );
};

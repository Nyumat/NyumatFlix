import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { Session } from "next-auth";
import Link from "next/link";
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
        <Link href="/login">
          <Button variant="ghost" size="sm" className="hidden md:flex">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </Link>
      )}
    </>
  );
};

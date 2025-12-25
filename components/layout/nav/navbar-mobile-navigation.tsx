"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { List, LogIn, LogOut, Menu } from "lucide-react";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface NavbarMobileNavigationProps {
  links: NavLink[];
  children: React.ReactNode;
  session: Session | null;
}

const getInitials = (email: string, name?: string | null) => {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
};

export const NavbarMobileNavigation = ({
  links,
  children,
  session,
}: NavbarMobileNavigationProps) => {
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleLinkClick = () => {
    setOpen(false);
  };

  const userEmail = session?.user?.email || "";
  const userName = session?.user?.name;
  const userImage = session?.user?.image;

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle navigation menu"
            className="h-10 w-10"
          >
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className={cn(
            "w-[85vw] sm:w-[400px] p-0 flex flex-col",
            "bg-black/95 backdrop-blur-xl border-r border-white/10",
            "shadow-2xl shadow-black/50",
          )}
        >
          <SheetHeader className="px-6 py-5 border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Link href="/" onClick={handleLinkClick} className="shrink-0">
                <Image
                  src="/logo.svg"
                  alt="NyumatFlix Logo"
                  width={150}
                  height={150}
                  className="size-8"
                />
              </Link>
              <SheetTitle className="text-left text-xl font-semibold text-white">
                Menu
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Navigation Links */}
            <div className="px-4 py-6 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "block w-full px-4 py-3.5 text-base font-medium rounded-xl transition-all duration-200",
                    "text-white/90 hover:text-white",
                    "hover:bg-white/10 hover:backdrop-blur-sm",
                    "focus:bg-white/10 focus:text-white focus:outline-none",
                    "active:bg-white/15",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Separator className="my-4 bg-white/10" />

            {/* Search Section */}
            <div className="px-4 py-4">{children}</div>
          </div>

          {/* Profile Section at Bottom */}
          <div className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
            {session ? (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/30 shadow-lg border-2 border-white/20">
                    <AvatarImage
                      src={userImage || ""}
                      alt={userName || userEmail}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold border-2 border-primary/30">
                      {getInitials(userEmail, userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    {userName && (
                      <p className="text-sm font-semibold text-white truncate">
                        {userName}
                      </p>
                    )}
                    <p className="text-xs text-white/70 truncate">
                      {userEmail}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/watchlist"
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3.5 text-base font-medium rounded-xl transition-all duration-200",
                      "text-white/90 hover:text-white",
                      "hover:bg-white/10 hover:backdrop-blur-sm",
                      "focus:bg-white/10 focus:text-white focus:outline-none",
                      "active:bg-white/15",
                    )}
                  >
                    <List className="h-5 w-5" />
                    <span>Watchlist</span>
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3.5 text-base font-medium rounded-xl transition-all duration-200",
                      "text-red-400 hover:text-red-300",
                      "hover:bg-red-500/10 hover:backdrop-blur-sm",
                      "focus:bg-red-500/10 focus:text-red-300 focus:outline-none",
                      "active:bg-red-500/15",
                    )}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <Link
                  href="/login"
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full px-4 py-3.5 text-base font-semibold rounded-xl transition-all duration-200",
                    "bg-primary text-white shadow-lg shadow-primary/30",
                    "hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black",
                    "active:scale-[0.98]",
                  )}
                >
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

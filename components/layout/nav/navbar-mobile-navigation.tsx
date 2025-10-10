"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface NavbarMobileNavigationProps {
  links: NavLink[];
  children: React.ReactNode;
}

export const NavbarMobileNavigation = ({
  links,
  children,
}: NavbarMobileNavigationProps) => {
  return (
    <div className="md:hidden">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle navigation menu"
            className="h-10 w-10"
          >
            <Menu size={20} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="end"
          side="bottom"
          sideOffset={8}
        >
          <div className="p-4 space-y-4">
            {/* Navigation Links */}
            <div className="space-y-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block w-full px-4 py-3 text-base font-medium rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  )}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Additional content (search, auth, etc.) */}
            <div className="pt-4 border-t border-border">{children}</div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

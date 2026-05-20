"use client";

import { List, Loader2, LogOut, Trash2 } from "lucide-react";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { navbarActionButtonClassName } from "./navbar-action-button";

interface UserAvatarProps {
  session: Session;
  triggerClassName?: string;
}

export const UserAvatar = ({ session, triggerClassName }: UserAvatarProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/user", { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      toast.success("Account deleted");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
      setIsDeletingAccount(false);
    }
  };

  // get initials from email or name
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

  const userEmail = session.user?.email || "";
  const userName = session.user?.name;
  const userImage = session.user?.image;

  return (
    <>
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
              "focus-visible:outline-hidden focus-visible:ring-2",
              "data-[state=open]:border-white/25 data-[state=open]:bg-white/10 data-[state=open]:text-white data-[state=open]:ring-white/20",
            )}
          >
            <Avatar className="size-full">
              <AvatarImage src={userImage || ""} alt={userName || userEmail} />
              <AvatarFallback className="bg-transparent text-sm font-semibold text-white">
                {getInitials(userEmail, userName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
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
                className="-mr-2 -mt-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleSignOut}
                size="icon"
                type="button"
                variant="ghost"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href="/watchlist">
            <DropdownMenuItem className="cursor-pointer">
              <List className="mr-2 h-4 w-4" />
              <span>Watchlist</span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-red-400 focus:text-red-400"
            onSelect={() => {
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete account</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingAccount) setIsDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and watchlist. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600 focus:ring-red-500"
              disabled={isDeletingAccount}
              onClick={(event) => {
                event.preventDefault();
                handleDeleteAccount();
              }}
            >
              {isDeletingAccount && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

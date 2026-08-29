"use client";

import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { MalLoginButton } from "@/components/auth/mal-login-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MalReauthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Prompts the user to reconnect MyAnimeList after their stored authorization
 * was revoked or expired (see `MalReauthRequiredError`). Reuses the same
 * `MalLoginButton` shown on `/login` so reconnecting is a single click.
 */
export function MalReauthModal({ open, onOpenChange }: MalReauthModalProps) {
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/12 bg-zinc-950/95 text-white sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            <TriangleAlert className="size-5" />
          </div>
          <DialogTitle className="text-xl">Reconnect MyAnimeList</DialogTitle>
          <DialogDescription>
            Your MyAnimeList authorization expired or was revoked. Reconnect to
            keep syncing your watchlist and episode progress.
          </DialogDescription>
        </DialogHeader>
        <MalLoginButton callbackUrl={pathname || "/"} helperText={null} />
      </DialogContent>
    </Dialog>
  );
}

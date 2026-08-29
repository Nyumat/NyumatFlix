"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { MalReauthModal } from "@/components/auth/mal-reauth-modal";
import { useMalSyncStatus } from "@/hooks/use-mal-sync-status";

/**
 * Mounted once near the app root. Watches MAL connection status (already
 * polled by the MAL widgets scattered around the app) and surfaces a
 * reconnect modal the moment `reauthRequired` flips true, instead of MAL
 * features silently failing until the user notices in Settings.
 */
export function MalReauthProvider() {
  const session = useSession();
  const isSignedIn = Boolean(session.data?.user?.id);
  const statusQuery = useMalSyncStatus();
  const reauthRequired = statusQuery.data?.reauthRequired === true;

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isSignedIn || dismissed) {
      return;
    }
    if (reauthRequired) {
      setOpen(true);
    }
  }, [dismissed, isSignedIn, reauthRequired]);

  if (!isSignedIn) {
    return null;
  }

  return (
    <MalReauthModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDismissed(true);
        }
      }}
    />
  );
}

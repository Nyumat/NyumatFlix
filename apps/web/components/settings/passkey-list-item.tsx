"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupAaguidName } from "@/lib/passkeys/aaguid-inventory";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export type PasskeyListItemData = {
  credentialID: string;
  credentialBackedUp: boolean;
  aaguid: string | null;
  nickname: string | null;
  title: string;
  subtitle: string;
  authenticatorName: string | null;
};

type PasskeyListItemProps = {
  passkey: PasskeyListItemData;
  removing: boolean;
  onRemove: () => void;
  onRename: (nickname: string) => Promise<void>;
};

export function PasskeyListItem({
  passkey,
  removing,
  onRemove,
  onRename,
}: PasskeyListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(passkey.nickname ?? passkey.title);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(passkey.nickname ?? passkey.title);
    }
  }, [isEditing, passkey.nickname, passkey.title]);

  const handleStartEditing = () => {
    setDraftName(passkey.nickname ?? passkey.title);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraftName(passkey.nickname ?? passkey.title);
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    const trimmed = draftName.trim();
    const current = (passkey.nickname ?? passkey.title).trim();

    if (!trimmed || trimmed === current) {
      handleCancelEditing();
      return;
    }

    setIsSaving(true);
    try {
      await onRename(trimmed);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEditing();
    }
  };

  const iconLabel =
    passkey.authenticatorName ?? lookupAaguidName(passkey.aaguid);

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-white/10 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-zinc-300"
          aria-hidden="true"
        >
          {iconLabel ? (
            <span className="px-1 text-center leading-tight">
              {iconLabel
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
          ) : (
            <Image
              src="/icon.png"
              alt=""
              width={20}
              height={20}
              className="opacity-80"
            />
          )}
        </div>

        <div className="min-w-0 space-y-1">
          {isEditing ? (
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => {
                void handleSubmit();
              }}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              autoFocus
              maxLength={80}
              aria-label="Passkey name"
              className="h-8 border-white/12 bg-black/25"
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={handleStartEditing}
                className={cn(
                  "min-w-0 truncate rounded px-1 text-left text-sm font-medium text-foreground transition",
                  "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
                )}
              >
                {passkey.title}
              </button>
              <button
                type="button"
                onClick={handleStartEditing}
                aria-label={`Rename ${passkey.title}`}
                className="shrink-0 rounded p-1 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{passkey.subtitle}</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={removing || isSaving}
        aria-label={`Remove ${passkey.title}`}
        onClick={onRemove}
      >
        {removing ? "Removing…" : "Remove"}
      </Button>
    </li>
  );
}

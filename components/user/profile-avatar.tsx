"use client";

import * as React from "react";
import BoringAvatar from "boring-avatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getAvatarColors,
  parseAvatarToken,
  DEFAULT_AVATAR_ACCENT,
  type AvatarVariant,
} from "@/lib/user/avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
  useAvatarShell?: boolean;
}

function getInitials(email: string, name?: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return email.slice(0, 2).toUpperCase();
}

function BoringAvatarCircle({
  variant,
  seed,
  accent,
  size,
  className,
}: {
  variant: AvatarVariant;
  seed: string;
  accent: string;
  size: number;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn("shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      {mounted ? (
        <BoringAvatar
          size={size}
          name={seed}
          variant={variant}
          colors={getAvatarColors(variant, accent)}
          square={false}
        />
      ) : null}
    </div>
  );
}

export function ProfileAvatar({
  image,
  name,
  email = "",
  size = 40,
  className,
  fallbackClassName,
  useAvatarShell = true,
}: ProfileAvatarProps) {
  const parsed = parseAvatarToken(image);
  const label = name || email || "User";

  const avatarContent =
    parsed?.type === "boring" ? (
      <BoringAvatarCircle
        variant={parsed.variant}
        seed={parsed.seed}
        accent={parsed.accent}
        size={size}
        className={className}
      />
    ) : parsed?.type === "dicebear" ? (
      <BoringAvatarCircle
        variant="beam"
        seed={parsed.seed}
        accent={DEFAULT_AVATAR_ACCENT}
        size={size}
        className={className}
      />
    ) : image?.trim() ? (
      useAvatarShell ? (
        <AvatarImage src={image} alt={label} />
      ) : (
        <img
          src={image}
          alt={label}
          width={size}
          height={size}
          className={cn("size-full rounded-full object-cover", className)}
        />
      )
    ) : null;

  if (!useAvatarShell) {
    return (
      avatarContent ?? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white",
            className,
          )}
          style={{ width: size, height: size }}
        >
          {getInitials(email ?? "", name)}
        </div>
      )
    );
  }

  return (
    <Avatar
      className={cn("size-full", className)}
      style={{ width: size, height: size }}
    >
      {avatarContent}
      <AvatarFallback
        className={cn(
          "bg-white/10 text-sm font-semibold text-white",
          fallbackClassName,
        )}
      >
        {getInitials(email ?? "", name)}
      </AvatarFallback>
    </Avatar>
  );
}

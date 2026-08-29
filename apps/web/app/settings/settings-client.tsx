"use client";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { AvatarAccentPicker } from "@/components/settings/avatar-accent-picker";
import { MalSyncPanel } from "@/components/settings/mal-sync-panel";
import { PlaybackPreferencesPanel } from "@/components/settings/playback-preferences-panel";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { scrapeServer, useServerStore } from "@/lib/stores/server-store";
import {
  AVATAR_PRESETS,
  AVATAR_VARIANT_LABELS,
  AVATAR_VARIANTS,
  DEFAULT_AVATAR_ACCENT,
  encodeAvatarToken,
  parseAvatarToken,
  randomAvatarSelection,
  resolveAvatarSelection,
  type AvatarPreset,
  type AvatarVariant,
} from "@/lib/user/avatar";
import type { MalSyncStatusResponse } from "@/lib/mal/types";
import { loginHref } from "@/lib/auth/callback-url";
import { resolveAuthSession } from "@/lib/auth/session-state";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Loader2,
  LogIn,
  ShieldOff,
  Shuffle,
  Trash2,
  Volume2,
} from "lucide-react";
import type { Session } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface SettingsClientProps {
  session: Session | null;
}

export function SettingsClient({ session }: SettingsClientProps) {
  const flags = useFeatureFlags();
  const { data: clientSession, status, update: updateSession } = useSession();
  const activeSession = resolveAuthSession(clientSession, status, session);
  const isSignedIn = Boolean(activeSession?.user?.id);

  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const disableHoverSound = useAppSettingsStore(
    (state) => state.disableHoverSound,
  );
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const setDisableHoverSound = useAppSettingsStore(
    (state) => state.setDisableHoverSound,
  );
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);

  const hideAll = flags?.locks.browseSettings ?? false;
  const hideNoAds = hideAll || flags?.locks.playbackMode;
  const hideHero = hideAll || flags?.locks.heroTrailers;
  const showPreferences = !(hideNoAds && hideHero);

  const handleNoAdsModeChange = (enabled: boolean) => {
    setNoAdsMode(enabled);
    if (enabled) {
      setSelectedServer(scrapeServer);
    }
  };

  const userEmail = activeSession?.user?.email ?? "";
  const userName = activeSession?.user?.name ?? "";
  const userImage = activeSession?.user?.image ?? null;

  const searchParams = useSearchParams();
  const isSetupName = searchParams.get("setup") === "name";
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(userName);
  const [selectedAvatarVariant, setSelectedAvatarVariant] =
    useState<AvatarVariant>("beam");
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState<AvatarPreset>(
    AVATAR_PRESETS[0],
  );
  const [selectedAvatarAccent, setSelectedAvatarAccent] = useState(
    DEFAULT_AVATAR_ACCENT,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [malPicture, setMalPicture] = useState<string | null>(null);

  const handleMalStatusChange = (status: MalSyncStatusResponse | null) => {
    setMalPicture(status?.connected ? (status.malPicture ?? null) : null);
  };

  useEffect(() => {
    setDisplayName(userName);
    const selection = resolveAvatarSelection(userImage);
    setSelectedAvatarVariant(selection.variant);
    setSelectedAvatarSeed(selection.seed);
    setSelectedAvatarAccent(selection.accent);
  }, [userImage, userName]);

  useEffect(() => {
    if (isSetupName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [isSetupName]);

  const previewAvatarToken = encodeAvatarToken(
    selectedAvatarVariant,
    selectedAvatarSeed,
    selectedAvatarAccent,
  );

  const savedAvatarSelection = resolveAvatarSelection(userImage);

  // If the account has no hand-picked avatar token saved yet, prefer showing
  // whatever real profile picture we have (e.g. a connected MAL account's
  // picture) instead of the generated placeholder. Saving a new pick from
  // the avatar grid below is the only thing that should override this.
  const hasCustomAvatarToken = parseAvatarToken(userImage) !== null;
  const fallbackAvatarUrl = hasCustomAvatarToken
    ? null
    : userImage || malPicture || null;

  const avatarSelectionChanged =
    selectedAvatarVariant !== savedAvatarSelection.variant ||
    selectedAvatarSeed !== savedAvatarSelection.seed ||
    selectedAvatarAccent !== savedAvatarSelection.accent;

  const displayedAvatarImage =
    !avatarSelectionChanged && fallbackAvatarUrl
      ? fallbackAvatarUrl
      : previewAvatarToken;

  const profileDirty = useMemo(() => {
    if (!isSignedIn) return false;
    const nameChanged = displayName.trim() !== (userName ?? "").trim();
    return avatarSelectionChanged || nameChanged;
  }, [avatarSelectionChanged, displayName, isSignedIn, userName]);

  const handleRandomAvatar = () => {
    const selection = randomAvatarSelection();
    setSelectedAvatarVariant(selection.variant);
    setSelectedAvatarSeed(selection.seed);
    setSelectedAvatarAccent(selection.accent);
  };

  const handleSaveProfile = async () => {
    if (!isSignedIn || !profileDirty) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error("Display name is required");
      return;
    }

    if (!selectedAvatarSeed) {
      toast.error("Choose an avatar");
      return;
    }

    const avatarToken = encodeAvatarToken(
      selectedAvatarVariant,
      selectedAvatarSeed,
      selectedAvatarAccent,
    );

    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          image: avatarToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to save profile",
        );
      }

      await updateSession({
        name: trimmedName,
        image: avatarToken,
      });
      toast.success("Profile updated");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setIsSavingProfile(false);
    }
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

  return (
    <div className="relative mx-auto min-h-[calc(100vh-7rem)] w-full max-w-7xl px-4 pt-10 pb-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] bg-linear-to-b from-black/80 via-black/70 to-transparent" />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-background/82 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-5 md:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Settings
          </h1>
        </div>

        {showPreferences ? (
          <section className="border-b border-white/10 px-4 py-5 md:px-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Playback
            </h2>

            <div className="divide-y divide-white/8">
              <div className="py-3.5">
                <PlaybackPreferencesPanel />
              </div>
              {!hideNoAds ? (
                <SettingSwitchRow
                  icon={ShieldOff}
                  title="No ads mode"
                  description="Proxy only — hides iframe and skips embed fallback"
                  checked={noAdsMode}
                  onCheckedChange={handleNoAdsModeChange}
                />
              ) : null}
              {!hideHero ? (
                <SettingSwitchRow
                  icon={ImageIcon}
                  title="Static hero"
                  description="Backdrop image instead of autoplay trailers"
                  checked={disableHeroTrailers}
                  onCheckedChange={setDisableHeroTrailers}
                />
              ) : null}
              <SettingSwitchRow
                icon={Volume2}
                title="Card hover sounds"
                description="Play sounds when hovering posters and cards"
                checked={!disableHoverSound}
                onCheckedChange={(enabled) => setDisableHoverSound(!enabled)}
              />
            </div>
          </section>
        ) : null}

        <section className="border-b border-white/10 px-4 py-5 md:px-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Integrations
          </h2>
          <MalSyncPanel
            isSignedIn={isSignedIn}
            onStatusChange={handleMalStatusChange}
          />
        </section>

        <section className="px-4 py-5 md:px-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Account
          </h2>

          {isSignedIn ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="relative size-24 overflow-hidden rounded-full border border-white/15 bg-white/5 p-0.5">
                    <ProfileAvatar
                      image={displayedAvatarImage}
                      name={displayName}
                      email={userEmail}
                      size={92}
                      useAvatarShell={false}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="settings-display-name">
                        Display name
                      </Label>
                      {isSetupName && !userName ? (
                        <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-xs font-medium text-sky-300 animate-pulse">
                          Enter a display name to get started
                        </span>
                      ) : null}
                    </div>
                    <Input
                      id="settings-display-name"
                      ref={nameInputRef}
                      placeholder="What should we call you?"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={100}
                      className={cn(
                        "border-white/12 bg-black/25",
                        isSetupName &&
                          !userName &&
                          "border-sky-400/50 ring-2 ring-sky-400/20",
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                      {userEmail || "Signed in with MyAnimeList (no email set)"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Avatar</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/12 bg-black/25"
                    onClick={handleRandomAvatar}
                  >
                    <Shuffle className="mr-2 size-3.5" />
                    Randomize
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {AVATAR_VARIANTS.map((variant) => {
                    const isActive = selectedAvatarVariant === variant;
                    return (
                      <button
                        key={variant}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setSelectedAvatarVariant(variant)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition",
                          isActive
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/25",
                        )}
                      >
                        {AVATAR_VARIANT_LABELS[variant]}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label>Accent</Label>
                  <AvatarAccentPicker
                    value={selectedAvatarAccent}
                    onChange={setSelectedAvatarAccent}
                  />
                </div>

                <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
                  {AVATAR_PRESETS.map((seed) => {
                    const token = encodeAvatarToken(
                      selectedAvatarVariant,
                      seed,
                      selectedAvatarAccent,
                    );

                    return (
                      <button
                        key={seed}
                        type="button"
                        aria-label={`Select ${AVATAR_VARIANT_LABELS[selectedAvatarVariant]} avatar ${seed}`}
                        aria-pressed={selectedAvatarSeed === seed}
                        onClick={() => setSelectedAvatarSeed(seed)}
                        className={cn(
                          "group flex flex-col items-center gap-1 rounded-xl border p-1.5 transition",
                          selectedAvatarSeed === seed
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-white/10 bg-black/20 hover:border-white/25",
                        )}
                      >
                        <ProfileAvatar
                          image={token}
                          name={seed}
                          size={48}
                          useAvatarShell={false}
                          className="border border-white/10"
                        />
                        <span className="w-full truncate text-center text-[10px] capitalize text-zinc-400 group-hover:text-zinc-200">
                          {seed}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!profileDirty || isSavingProfile}
                  onClick={handleSaveProfile}
                >
                  {isSavingProfile ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Save profile
                </Button>
              </div>

              <div className="border-t border-white/8 pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-500 hover:bg-red-600"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete account
                </Button>
              </div>
            </div>
          ) : (
            <Button asChild variant="chrome" className="gap-2.5">
              <Link href={loginHref("/settings")}>
                Sign in
                <LogIn className="size-4 shrink-0" />
              </Link>
            </Button>
          )}
        </section>
      </div>

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
                void handleDeleteAccount();
              }}
            >
              {isDeletingAccount ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingSwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  icon: typeof ShieldOff;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className="mt-0.5 size-4 shrink-0 text-zinc-300"
          strokeWidth={1.65}
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
      />
    </div>
  );
}

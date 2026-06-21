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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavbarSearchClientProps } from "@/components/search/search";
import { navigation, type NavItem } from "@/config/site";
import { useWatchlistSummary } from "@/hooks/useWatchlistSummary";
import {
  getBrowseLinkLabel,
  getBrowseLinks,
  getNavIcon,
  hasBrowseSubmenu,
  isCurrentHref,
  isInNavGroup,
  toTitleCase,
} from "@/lib/nav/browse";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Trash2,
} from "lucide-react";
import type { Session } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  navMobileMenuClassName,
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "./navbar-action-button";

interface NavbarMobileNavigationProps {
  children: React.ReactNode;
  session: Session | null;
  triggerClassName?: string;
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

const drawerSurfaceClassName =
  "border border-white/10 bg-card/45 backdrop-blur-md dark:border-white/30 dark:bg-white/10";

export const NavbarMobileNavigation = ({
  children,
  session,
  triggerClassName,
}: NavbarMobileNavigationProps) => {
  const [open, setOpen] = useState(false);
  const [detailItemTitle, setDetailItemTitle] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: clientSession } = useSession();
  const activeSession = clientSession ?? session;

  const { data: watchlistSummary, isLoading: isWatchlistLoading } =
    useWatchlistSummary(open && Boolean(activeSession));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDetailItemTitle(null);
    }
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
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
      setOpen(false);
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
      setIsDeletingAccount(false);
    }
  };

  const handleLinkClick = () => {
    setOpen(false);
  };

  const userEmail = activeSession?.user?.email || "";
  const userName = activeSession?.user?.name;
  const userImage = activeSession?.user?.image;

  const searchContent =
    isValidElement(children) && typeof children.type !== "string"
      ? cloneElement(children as React.ReactElement<NavbarSearchClientProps>, {
          onAfterNavigation: handleLinkClick,
          className: "mx-0 max-w-none",
        })
      : children;

  const activeItem = navigation.items.find((item) =>
    isInNavGroup(pathname, searchParams, item),
  );
  const detailItem = detailItemTitle
    ? navigation.items.find((item) => item.title === detailItemTitle)
    : null;

  if (!isMounted) {
    return (
      <div className={navMobileMenuClassName}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle navigation menu"
          className={cn(navbarActionButtonClassName, triggerClassName)}
        >
          <Menu className={navbarActionIconClassName} strokeWidth={1.75} />
        </Button>
      </div>
    );
  }

  return (
    <div className={navMobileMenuClassName}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="icon"
            aria-label="Toggle navigation menu"
            className={cn(navbarActionButtonClassName, triggerClassName)}
          >
            <Menu className={navbarActionIconClassName} strokeWidth={1.75} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            menuTriggerRef.current?.focus();
          }}
          className={cn(
            "w-[min(92vw,400px)] gap-0 p-0 flex flex-col overflow-hidden",
            "border-r border-white/12 bg-black/92 backdrop-blur-xl",
            "shadow-2xl shadow-black/60",
          )}
        >
          <SheetHeader className="border-b border-white/10 px-5 py-4 text-left">
            <div className="flex items-center gap-3 pr-10">
              <Link
                href="/"
                onClick={handleLinkClick}
                className="flex size-8 shrink-0 items-center justify-center"
              >
                <Image
                  src="/logo.svg"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8"
                />
              </Link>
              <SheetTitle className="text-left text-lg font-semibold tracking-tight text-white">
                NyumatFlix
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="space-y-4 px-4 py-4">
              {searchContent}

              {activeSession ? (
                <LoggedInProfileCard
                  userEmail={userEmail}
                  userName={userName}
                  userImage={userImage}
                  watchlistSummary={watchlistSummary}
                  isWatchlistLoading={isWatchlistLoading}
                  onNavigate={handleLinkClick}
                />
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium text-white/70">Browse</p>
                  {detailItem ? (
                    <button
                      type="button"
                      onClick={() => setDetailItemTitle(null)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary/80"
                    >
                      <ChevronLeft className="size-3.5" strokeWidth={1.75} />
                      Back
                    </button>
                  ) : null}
                </div>

                {detailItem ? (
                  <MobileBrowseDetail
                    item={detailItem}
                    pathname={pathname}
                    searchParams={searchParams}
                    onNavigate={handleLinkClick}
                  />
                ) : (
                  <MobileBrowseRoot
                    activeTitle={activeItem?.title}
                    onOpenDetail={setDetailItemTitle}
                    onNavigate={handleLinkClick}
                  />
                )}
              </section>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md">
            {activeSession ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-white/85 transition",
                    drawerSurfaceClassName,
                    "hover:border-white/25 hover:bg-white/15 hover:text-white",
                  )}
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm font-medium text-red-300 backdrop-blur-md transition",
                    "hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200",
                  )}
                >
                  <Trash2 className="size-4" />
                  Delete account
                </button>
              </div>
            ) : (
              <Button asChild variant="chrome" className="w-full gap-2">
                <Link href="/login" onClick={handleLinkClick}>
                  Sign in
                  <LogIn className="size-4 shrink-0" />
                </Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isDeletingAccount) setIsDeleteDialogOpen(nextOpen);
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
    </div>
  );
};

const LoggedInProfileCard = ({
  userEmail,
  userName,
  userImage,
  watchlistSummary,
  isWatchlistLoading,
  onNavigate,
}: {
  userEmail: string;
  userName?: string | null;
  userImage?: string | null;
  watchlistSummary?: {
    total: number;
    watching: number;
    waiting: number;
    finished: number;
  };
  isWatchlistLoading: boolean;
  onNavigate: () => void;
}) => (
  <div className={cn("overflow-hidden rounded-xl", drawerSurfaceClassName)}>
    <div className="border-b border-white/10 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 border border-white/20">
          <AvatarImage src={userImage || ""} alt={userName || userEmail} />
          <AvatarFallback className="bg-white/10 text-sm font-semibold text-white">
            {getInitials(userEmail, userName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {userName || "Your account"}
          </p>
          <p className="truncate text-xs text-white/60">{userEmail}</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2 px-3 py-3">
      <WatchlistStat
        label="Watching"
        value={watchlistSummary?.watching}
        isLoading={isWatchlistLoading}
      />
      <WatchlistStat
        label="Waiting"
        value={watchlistSummary?.waiting}
        isLoading={isWatchlistLoading}
      />
      <WatchlistStat
        label="Finished"
        value={watchlistSummary?.finished}
        isLoading={isWatchlistLoading}
      />
    </div>

    <Link
      href="/watchlist"
      onClick={onNavigate}
      className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
    >
      <span className="inline-flex items-center gap-2">
        <List className="size-4 text-primary" />
        My Watchlist
        {!isWatchlistLoading && watchlistSummary ? (
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-white/70">
            {watchlistSummary.total}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-4 text-white/45" />
    </Link>
  </div>
);

const WatchlistStat = ({
  label,
  value,
  isLoading,
}: {
  label: string;
  value?: number;
  isLoading: boolean;
}) => (
  <div
    className={cn("rounded-lg px-2.5 py-2 text-center", drawerSurfaceClassName)}
  >
    {isLoading ? (
      <Skeleton className="mx-auto h-5 w-8 rounded-md bg-white/10" />
    ) : (
      <p className="text-lg font-semibold text-white">{value ?? 0}</p>
    )}
    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/45">
      {label}
    </p>
  </div>
);

const MobileBrowseRoot = ({
  activeTitle,
  onOpenDetail,
  onNavigate,
}: {
  activeTitle?: string;
  onOpenDetail: (title: string) => void;
  onNavigate: () => void;
}) => (
  <div className="grid grid-cols-2 gap-2">
    {navigation.items.map((item) => {
      const Icon = getNavIcon(item);
      const isActive = item.title === activeTitle;
      const tileClassName = cn(
        "group flex h-[72px] flex-col items-start justify-between rounded-xl p-3 text-left text-white outline-hidden transition-all",
        drawerSurfaceClassName,
        "hover:border-white/25 hover:bg-white/15 active:scale-[0.98]",
        isActive &&
          "border-primary/35 bg-primary/10 text-primary ring-1 ring-primary/20",
      );

      if (!hasBrowseSubmenu(item)) {
        return (
          <Link
            key={item.title}
            href={item.href}
            onClick={onNavigate}
            className={tileClassName}
          >
            <div className="flex w-full items-center justify-between">
              <Icon className="size-5" strokeWidth={1.65} />
              {isActive ? (
                <Check className="size-4" strokeWidth={1.75} />
              ) : null}
            </div>
            <span className="text-sm font-medium text-white">
              {toTitleCase(item.title)}
            </span>
          </Link>
        );
      }

      return (
        <button
          key={item.title}
          type="button"
          onClick={() => onOpenDetail(item.title)}
          className={tileClassName}
        >
          <div className="flex w-full items-center justify-between">
            <Icon className="size-5" strokeWidth={1.65} />
            {isActive ? (
              <Check className="size-4" strokeWidth={1.75} />
            ) : (
              <ChevronRight
                className="size-4 opacity-55 transition group-hover:translate-x-0.5 group-hover:opacity-90"
                strokeWidth={1.75}
              />
            )}
          </div>
          <span className="text-sm font-medium text-white">
            {toTitleCase(item.title)}
          </span>
        </button>
      );
    })}
  </div>
);

const MobileBrowseDetail = ({
  item,
  pathname,
  searchParams,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate: () => void;
}) => {
  const Icon = getNavIcon(item);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2.5",
          drawerSurfaceClassName,
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" strokeWidth={1.65} />
        </span>
        <p className="text-sm font-semibold text-white">
          {toTitleCase(item.title)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {getBrowseLinks(item).map((child) => {
          const isActive = isCurrentHref(pathname, searchParams, child.href);

          return (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white transition-all",
                drawerSurfaceClassName,
                "hover:border-primary/35 hover:bg-primary/10 active:scale-[0.98]",
                isActive && "border-primary/40 bg-primary/12 text-primary",
              )}
            >
              <span>{getBrowseLinkLabel(item, child)}</span>
              {isActive ? (
                <Check className="size-4" strokeWidth={1.75} />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

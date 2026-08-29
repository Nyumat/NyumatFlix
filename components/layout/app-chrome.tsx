"use client";

import { NavbarClient } from "@/components/layout/nav/navbar-client";
import { FooterSection } from "@/components/layout/sections/footer";
import { AppSettingsSync } from "@/components/providers/app-settings-sync";
import { MalReauthProvider } from "@/components/providers/mal-reauth-provider";
import { GlobalDockProvider } from "@/components/layout/dock/global-dock";
import { AppChromeDeferred } from "@/components/layout/app-chrome-deferred";
import { Toaster } from "@/components/ui/sonner";
import { usePathname } from "next/navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFfsAdmin = pathname.startsWith("/ffs");

  if (isFfsAdmin) {
    return (
      <>
        <AppChromeDeferred />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Toaster richColors closeButton />
      </>
    );
  }

  return (
    <>
      <AppChromeDeferred />
      <AppSettingsSync />
      <MalReauthProvider />
      <GlobalDockProvider>
        <NavbarClient />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <FooterSection />
        <Toaster richColors closeButton />
      </GlobalDockProvider>
    </>
  );
}

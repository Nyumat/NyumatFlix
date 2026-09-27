"use client";

import { NavbarClient } from "@/components/layout/nav/navbar-client";
import { FooterSection } from "@/components/layout/sections/footer";
import { AppSettingsSync } from "@/components/providers/app-settings-sync";
import { ExperienceSettingsSync } from "@/components/providers/experience-settings-sync";
import { CatalogCardStyleSync } from "@/components/providers/catalog-card-style-sync";
import { MalReauthProvider } from "@/components/providers/mal-reauth-provider";
import { GlobalDockProvider } from "@/components/layout/dock/global-dock";
import { AppChromeDeferred } from "@/components/layout/app-chrome-deferred";
import { Toaster } from "@/components/ui/sonner";
import { isFfsAdminPath } from "@/lib/ffs/ffs-host-paths";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const AppChromeFallback = ({ children }: { children: ReactNode }) => (
  <>
    <AppChromeDeferred />
    <div className="w-full flex-1">{children}</div>
    <Toaster />
  </>
);

const AppChromeBody = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isFfsAdmin = pathname.startsWith("/ffs");
  const isManifesto = pathname === "/manifesto";

  if (isFfsAdmin) {
    return (
      <>
        <AppChromeDeferred />
        <div className="w-full flex-1">{children}</div>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <AppChromeDeferred />
      <AppSettingsSync />
      <ExperienceSettingsSync />
      <CatalogCardStyleSync />
      <MalReauthProvider />
      <GlobalDockProvider>
        {isManifesto ? null : <NavbarClient />}
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <FooterSection />
        <Toaster />
      </GlobalDockProvider>
    </>
  );
};

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppChromeFallback>{children}</AppChromeFallback>}>
      <AppChromeBody>{children}</AppChromeBody>
    </Suspense>
  );
}

import { auth } from "@/auth";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings | NyumatFlix",
  description: "Manage your preferences and account settings",
};

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="z-10 flex w-full flex-1 flex-col items-center">
        <Suspense fallback={null}>
          <SettingsClient session={session} />
        </Suspense>
      </ContentContainer>
    </div>
  );
}

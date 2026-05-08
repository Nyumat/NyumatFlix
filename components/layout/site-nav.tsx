"use client";

import { navigation } from "@/config/site";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";

const SiteNavDesktop = dynamic(
  () => import("./site-nav-desktop").then((mod) => mod.SiteNavDesktop),
  {
    ssr: false,
    loading: () => (
      <div
        className="hidden min-h-10 shrink-0 items-center gap-1 lg:flex"
        aria-hidden
      >
        {navigation.items.map((item) => (
          <div
            key={item.title}
            className="h-10 min-w-13 animate-pulse rounded-full bg-muted/25"
          />
        ))}
      </div>
    ),
  },
);

const SiteNav = () => {
  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="shrink-0">
        <Image
          src="/logo.svg"
          alt="NyumatFlix"
          width={28}
          height={28}
          className="size-7"
        />
        <span className="sr-only">NyumatFlix</span>
      </Link>

      <SiteNavDesktop />
    </div>
  );
};

export { SiteNav };

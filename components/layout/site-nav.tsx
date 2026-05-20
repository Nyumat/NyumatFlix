"use client";

import Image from "next/image";
import Link from "next/link";

const SiteNav = () => {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/"
        className="flex size-7 shrink-0 items-center justify-center"
      >
        <Image
          src="/logo.svg"
          alt="NyumatFlix"
          width={28}
          height={28}
          className="size-7 shrink-0"
        />
        <span className="sr-only">NyumatFlix</span>
      </Link>
    </div>
  );
};

export { SiteNav };

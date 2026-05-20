import { Check, Play, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

const watchlistPreviewItems = [
  {
    title: "Dune: Part Two",
    poster: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  },
  {
    title: "Inside Out 2",
    poster: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
  },
  {
    title: "The Batman",
    poster: "/74xTEgt7R36Fpooo50r9T25onhq.jpg",
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    poster: "/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
  },
  {
    title: "Oppenheimer",
    poster: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  },
  {
    title: "Interstellar",
    poster: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  },
  {
    title: "Everything Everywhere All at Once",
    poster: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
  },
  {
    title: "Godzilla Minus One",
    poster: "/hkxxMIGaiCTmrEArK7J56JTKUlB.jpg",
  },
  {
    title: "The Wild Robot",
    poster: "/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg",
  },
  {
    title: "Barbie",
    poster: "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
  },
  {
    title: "Top Gun: Maverick",
    poster: "/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
  },
  {
    title: "The Super Mario Bros. Movie",
    poster: "/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg",
  },
  {
    title: "Avatar: The Way of Water",
    poster: "/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
  },
  {
    title: "Mission: Impossible - Dead Reckoning",
    poster: "/NNxYkU70HPurnNCSiCjYAmacwm.jpg",
  },
  {
    title: "Guardians of the Galaxy Vol. 3",
    poster: "/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg",
  },
  {
    title: "The Fall Guy",
    poster: "/tSz1qsmSJon0rqjHBxXZmrotuse.jpg",
  },
];

const continuePreview = {
  title: "Stranger Things",
  episode: "S4 E7",
  timestamp: "41:08",
  runtime: "1h 38m",
  poster: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
};

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <Image
          src="/movie-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60 saturate-[0.82]"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.62)_48%,rgba(0,0,0,0.82)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-5 pb-8 pt-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-10 lg:pt-16">
        <section className="hidden max-w-xl lg:block">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-3 text-white"
            aria-label="NyumatFlix home"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <Image
                src="/logo.svg"
                alt=""
                width={28}
                height={28}
                className="size-7"
              />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              NyumatFlix
            </span>
          </Link>

          <p className="mb-4 text-sm font-medium leading-6 text-sky-200">
            {eyebrow}
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.02] tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-zinc-300">
            {description}
          </p>

          <WatchlistPreview />
        </section>

        <section className="mx-auto w-full max-w-[27rem]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="NyumatFlix home"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 backdrop-blur-md">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={28}
                  height={28}
                  className="size-7"
                />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                NyumatFlix
              </span>
            </Link>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

function WatchlistPreview() {
  const marqueeItems = [...watchlistPreviewItems, ...watchlistPreviewItems];

  return (
    <div className="mt-9 max-w-[34rem] overflow-hidden rounded-2xl border border-white/12 bg-black/30 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">My Watchlist</p>
          <p className="mt-0.5 text-xs text-zinc-500">Popular picks saved</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
          <Check className="size-3.5 text-sky-200" />
          Synced
        </div>
      </div>

      <div className="relative -mx-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-linear-to-r from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-black/80 to-transparent" />
        <div className="flex w-max motion-safe:animate-[auth-poster-marquee_32s_linear_infinite]">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="relative mr-3 aspect-poster w-20 shrink-0 overflow-hidden rounded-sm border border-white/10 bg-zinc-900"
            >
              <Image
                src={`https://image.tmdb.org/t/p/w342${item.poster}`}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="relative aspect-poster w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
          <Image
            src={`https://image.tmdb.org/t/p/w185${continuePreview.poster}`}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white">
              {continuePreview.title}
            </p>
            <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
              {continuePreview.episode}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span>Resume at {continuePreview.timestamp}</span>
            <span className="size-1 rounded-full bg-zinc-700" />
            <span>{continuePreview.runtime}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[55%] rounded-full bg-sky-300/80" />
          </div>
        </div>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white"
          aria-label="Preview play action"
        >
          <Play className="ml-0.5 size-4 fill-current" />
        </button>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300"
          aria-label="Preview add action"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

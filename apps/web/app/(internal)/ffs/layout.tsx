import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FFS Admin | NyumatFlix",
  robots: { index: false, follow: false },
};

export default function FfsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-foreground">
      {children}
    </div>
  );
}

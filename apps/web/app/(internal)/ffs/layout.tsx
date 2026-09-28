import type { Metadata } from "next";
import { FfsScrollRoot } from "@/components/ffs/ffs-scroll-root";

export const metadata: Metadata = {
  title: "FFS Admin | NyumatFlix",
  robots: { index: false, follow: false },
};

export default function FfsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FfsScrollRoot>
      <div className="ffs-admin bg-background text-foreground [--radius:0.375rem]">
        {children}
      </div>
    </FfsScrollRoot>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ContentRowHeaderProps {
  title: string;
  href: string;
}

export function ContentRowHeader({ title, href }: ContentRowHeaderProps) {
  return (
    <div className="content-row-header mb-5 flex items-end justify-between px-1">
      <div className="space-y-1">
        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
        <div className="h-1 w-12 bg-primary/60 rounded-full" />
      </div>
      <Link
        href={href}
        className="group flex items-center gap-1 text-xs md:text-sm font-bold text-muted-foreground hover:text-primary transition-all duration-300 bg-white/5 hover:bg-primary/10 px-3 py-1.5 rounded-full border border-white/10 hover:border-primary/30"
      >
        <span>View all</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

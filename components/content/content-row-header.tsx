import Link from "next/link";

interface ContentRowHeaderProps {
  title: string;
  href: string;
}

export function ContentRowHeader({ title, href }: ContentRowHeaderProps) {
  return (
    <div className="content-row-header mb-4 flex items-center justify-between">
      <h2 className="text-xl md:text-2xl font-bold z-10 text-foreground">
        {title}
      </h2>
      <Link href={href}>
        <span className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors">
          View all
        </span>
      </Link>
    </div>
  );
}

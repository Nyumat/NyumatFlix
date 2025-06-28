import Link from "next/link";

interface ContentRowHeaderProps {
  title: string;
  href: string;
}

export function ContentRowHeader({ title, href }: ContentRowHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl md:text-2xl font-bold z-10 text-white">{title}</h2>
      <Link href={href}>
        <span className="text-sm hover:text-yellow-400 hover:underline">
          View all
        </span>
      </Link>
    </div>
  );
}

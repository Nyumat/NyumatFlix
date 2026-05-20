import { ReactNode } from "react";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <>
      <div className="text-center my-8 mt-20">
        <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
      </div>
      <div className="w-full max-w-4xl mx-auto px-4 mb-16">
        <div className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl">
          <div className="prose prose-invert max-w-none">{children}</div>
        </div>
      </div>
    </>
  );
}

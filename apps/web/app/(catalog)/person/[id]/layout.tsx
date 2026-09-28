import { PersonScrollReset } from "@/components/person/person-scroll-reset";
import { Suspense } from "react";

export default function PersonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <PersonScrollReset />
      </Suspense>
      {children}
    </div>
  );
}

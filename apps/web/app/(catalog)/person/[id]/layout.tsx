import { PersonScrollReset } from "@/components/person/person-scroll-reset";

export default function PersonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <PersonScrollReset />
      {children}
    </div>
  );
}

import { CardHoverPreviewProvider } from "@/components/providers/card-hover-preview-provider";
import { HoverSoundProvider } from "@/components/providers/hover-sound-provider";
import type { ReactNode } from "react";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <CardHoverPreviewProvider>
      <HoverSoundProvider>{children}</HoverSoundProvider>
    </CardHoverPreviewProvider>
  );
}

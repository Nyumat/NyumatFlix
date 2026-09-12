import { SilkShaderBackground } from "@/components/hero/silk-shader-background";
import Image from "next/image";

export type PageBackdrop = {
  imageUrl: string;
  alt: string;
  priority?: boolean;
};

type AmbientPageBackdropProps = {
  backdrop?: PageBackdrop | null;
};

export function AmbientPageBackdrop({ backdrop }: AmbientPageBackdropProps) {
  if (!backdrop?.imageUrl) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
        data-page-backdrop="shader"
      >
        <SilkShaderBackground className="h-full w-full opacity-70" />
        <div className="absolute inset-0 bg-linear-to-b from-black/45 via-background/64 to-background" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-background" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050505]"
      data-page-backdrop="image"
    >
      <Image
        src={backdrop.imageUrl}
        alt=""
        fill
        priority={backdrop.priority}
        sizes="100vw"
        className="scale-[1.2] object-cover opacity-50 blur-[80px] saturate-100"
      />
      <div className="absolute left-0 top-0 hidden h-[40dvh] w-full mix-blend-screen opacity-20 lg:block">
        <Image
          src={backdrop.imageUrl}
          alt=""
          fill
          priority={backdrop.priority}
          sizes="100vw"
          className="scale-[1.2] object-cover blur-[50px] saturate-100 [mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)]"
        />
      </div>
    </div>
  );
}

import Image from "next/image";

type FeatureHeroBackdropProps = {
  imageUrl: string;
  priority?: boolean;
};

export function FeatureHeroBackdrop({
  imageUrl,
  priority,
}: FeatureHeroBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[105dvh] overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]"
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-transparent" />
    </div>
  );
}

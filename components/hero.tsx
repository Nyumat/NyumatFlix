import Image from "next/image";

interface HeroProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
}

export function HeaderHero({ imageUrl, title }: HeroProps) {
  return (
    <>
      <div
        className={`relative w-full ${
          imageUrl.includes("search") ? "h-[50vh]" : "h-[40vh]"
        }`}
      >
        <Image
          src={imageUrl}
          alt={title}
          layout="fill"
          objectFit="cover"
          className="rounded-lg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-70" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-50 -z-10" />
    </>
  );
}

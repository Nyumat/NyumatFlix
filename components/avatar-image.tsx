"use client";

import Image from "next/legacy/image";
import { useState } from "react";

interface AvatarImageProps {
  src: string;
  alt: string;
  fallbackText: string;
}

export default function AvatarImage({
  src,
  alt,
  fallbackText,
}: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        {fallbackText.substring(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      className="rounded-full w-full h-full object-cover"
      onError={() => setHasError(true)}
    />
  );
}

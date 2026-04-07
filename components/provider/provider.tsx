import { ComponentProps } from "react";
import Image from "next/image";
import React from "react";
import { Buy, Flatrate, Rent } from "@/tmdb/models";
import { LogoSize, tmdbImage } from "@/tmdb/utils";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProviderLogoProps extends ComponentProps<"div"> {
  image?: string;
  size?: LogoSize;
  alt: string;
  priority?: boolean;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  image,
  size = "w154",
  alt,
  className,
  priority,
  ...props
}) => {
  const src = image ? tmdbImage.logo(image, size) : null;

  if (!src) {
    return (
      <div
        className={cn("size-full bg-muted text-muted-foreground", className)}
        {...props}
      >
        <div className="grid size-full place-items-center">
          <Icons.Logo className="size-6" />
        </div>
      </div>
    );
  }

  return (
    <Image
      className={cn("size-full bg-muted object-cover", className)}
      src={src}
      alt={alt}
      priority={priority}
      unoptimized
      fill
    />
  );
};

interface ProviderTableProps {
  title: "Stream" | "Buy" | "Rent";
  providers: (Flatrate | Buy | Rent)[];
}

export const ProviderTable: React.FC<ProviderTableProps> = ({
  title,
  providers,
}) => {
  return (
    <Table>
      <TableHeader className="select-none">
        <TableRow>
          <TableHead colSpan={2}>{title}</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {providers?.map((provider) => (
          <TableRow key={provider.provider_id} className="select-none">
            <TableCell className="w-8 p-0 pl-4">
              <div className="relative aspect-square w-8">
                <ProviderLogo
                  image={provider.logo_path}
                  alt={provider.provider_name}
                  className="rounded-md border"
                />
              </div>
            </TableCell>
            <TableCell>{provider.provider_name}</TableCell>
          </TableRow>
        ))}

        {!providers?.length && (
          <TableRow className="select-none">
            <TableCell colSpan={2} className="text-muted-foreground">
              Not available
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

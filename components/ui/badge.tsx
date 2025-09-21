"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border border-input",
        chrome:
          "backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40 shadow-lg",
        stylish:
          "bg-gradient-to-r from-[#D247BF]/20 to-primary/20 text-white border border-white/20 backdrop-blur-sm hover:from-[#D247BF]/30 hover:to-primary/30 hover:border-white/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  href?: string;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, href, ...props }, ref) => {
    const router = useRouter();

    const handleMouseEnter = () => {
      if (href) {
        router.prefetch(href);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
        onClick={(e) => {
          props.onClick?.(e);
          if (href) {
            router.push(href);
          }
        }}
        onMouseEnter={handleMouseEnter}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
